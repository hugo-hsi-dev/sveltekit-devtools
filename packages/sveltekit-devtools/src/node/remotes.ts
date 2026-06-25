import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';

import type { RemoteFunctionInfo, RemoteFunctionKind } from '../shared/types.js';

interface ScanRemotesOptions {
	root: string;
	srcDir: string;
}

const remoteNames = new Set(['query', 'form', 'command', 'prerender']);
const runtimeImportLine =
	"import { __sveltekitDevtoolsTrackRemote } from 'virtual:sveltekit-devtools/runtime';";

export async function scanRemotes({
	root,
	srcDir,
}: ScanRemotesOptions): Promise<RemoteFunctionInfo[]> {
	if (!(await exists(srcDir))) return [];

	const files = (await walk(srcDir)).filter(
		(file) => /\.remote\.[jt]s$/.test(file) && !isInside(path.join(srcDir, 'lib/server'), file),
	);
	const remotes: RemoteFunctionInfo[] = [];

	for (const file of files) {
		const source = await readFile(file, 'utf-8');
		const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const imports = collectRemoteImports(ast);

		for (const statement of ast.statements) {
			if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;

			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
				const kind = getRemoteKind(declaration.initializer, imports);
				if (!kind) continue;

				remotes.push({
					id: `${slash(path.relative(root, file))}:${declaration.name.text}`,
					name: declaration.name.text,
					kind,
					file: slash(path.relative(root, file)),
					importPath: viteFsPath(file),
					validator: validatorKind(declaration.initializer),
					callable: kind !== 'form',
				});
			}
		}
	}

	return remotes.sort((a, b) => a.id.localeCompare(b.id));
}

export function isRemoteModule(file: string, srcDir: string) {
	return /\.remote\.[jt]s$/.test(file) && !isInside(path.join(srcDir, 'lib/server'), file);
}

export function transformRemoteModule(code: string, file: string, root: string) {
	const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const imports = collectRemoteImports(source);
	const edits: Array<{ start: number; end: number; replacement: string }> = [];

	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;

		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
			const kind = getRemoteKind(declaration.initializer, imports);
			if (!kind || !ts.isCallExpression(declaration.initializer)) continue;

			const handler = findHandlerArgument(declaration.initializer);
			if (!handler) continue;

			const start = handler.getStart(source);
			const end = handler.end;
			const meta = JSON.stringify({
				name: declaration.name.text,
				kind,
				file: slash(path.relative(root, file)),
				importPath: viteFsPath(file),
			});

			edits.push({
				start,
				end,
				replacement: `__sveltekitDevtoolsTrackRemote(${meta}, ${code.slice(start, end).trimEnd()})`,
			});
		}
	}

	if (edits.length === 0) return null;

	let next = code;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
	}
	if (!code.includes('virtual:sveltekit-devtools/runtime')) next = `${runtimeImportLine}\n${next}`;

	return { code: next, map: null };
}

function collectRemoteImports(ast: ts.SourceFile) {
	const imports = new Map<string, string>();

	for (const statement of ast.statements) {
		if (!ts.isImportDeclaration(statement)) continue;
		if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
		if (statement.moduleSpecifier.text !== '$app/server') continue;

		const named = statement.importClause?.namedBindings;
		if (!named || !ts.isNamedImports(named)) continue;
		for (const element of named.elements) {
			const imported = element.propertyName?.text ?? element.name.text;
			if (remoteNames.has(imported)) imports.set(element.name.text, imported);
		}
	}

	return imports;
}

function getRemoteKind(
	node: ts.Expression,
	imports: Map<string, string>,
): RemoteFunctionKind | null {
	if (!ts.isCallExpression(node)) return null;

	const expression = node.expression;
	if (ts.isIdentifier(expression)) {
		const name = imports.get(expression.text);
		return isRemoteKind(name) ? name : null;
	}

	if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
		const base = imports.get(expression.expression.text);
		if (base === 'query' && (expression.name.text === 'batch' || expression.name.text === 'live')) {
			return `query.${expression.name.text}` as RemoteFunctionKind;
		}
	}

	return null;
}

function validatorKind(node: ts.Expression): RemoteFunctionInfo['validator'] {
	if (!ts.isCallExpression(node)) return 'none';
	const first = node.arguments[0];
	if (!first || ts.isArrowFunction(first) || ts.isFunctionExpression(first)) return 'none';
	if (ts.isStringLiteral(first) && first.text === 'unchecked') return 'unchecked';
	return 'schema';
}

function findHandlerArgument(node: ts.CallExpression) {
	return [...node.arguments]
		.reverse()
		.find((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
}

function isRemoteKind(value: string | undefined): value is RemoteFunctionKind {
	return value === 'query' || value === 'form' || value === 'command' || value === 'prerender';
}

function isExported(node: ts.Node) {
	return Boolean(
		ts.canHaveModifiers(node) &&
		ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
	);
}

async function walk(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const file = path.join(dir, entry.name);
			return entry.isDirectory() ? walk(file) : [file];
		}),
	);
	return nested.flat();
}

async function exists(file: string) {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
}

function isInside(parent: string, child: string) {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function slash(value: string) {
	return value.replaceAll(path.sep, '/');
}

function viteFsPath(file: string) {
	const normalized = slash(file);
	return normalized.startsWith('/') ? `/@fs${normalized}` : `/@fs/${normalized}`;
}
