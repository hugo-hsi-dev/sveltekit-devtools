import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';

import type { HookEnvironment, HookInfo } from '../shared/types.js';
import { fileExists, slash } from './files.js';

interface ScanHooksOptions {
	root: string;
	srcDir: string;
}

const hookFunctionNames = new Set([
	'handle',
	'handleFetch',
	'handleValidationError',
	'handleError',
	'init',
	'reroute',
]);
const hookExportNames = new Set([...hookFunctionNames, 'transport']);
const runtimeImportLine =
	"import { __sveltekitDevtoolsTrackHook } from 'virtual:sveltekit-devtools/runtime';";

export async function scanHooks({ root, srcDir }: ScanHooksOptions): Promise<HookInfo[]> {
	const files = await existingHookFiles(srcDir);
	const hooks: HookInfo[] = [];

	for (const file of files) {
		const code = await readFile(file, 'utf-8');
		const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const environment = hookEnvironment(file);

		for (const statement of source.statements) {
			if (ts.isFunctionDeclaration(statement) && isExported(statement) && statement.name) {
				addHook(hooks, root, file, environment, statement.name.text, true);
			}

			if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) continue;
				addHook(
					hooks,
					root,
					file,
					environment,
					declaration.name.text,
					hookFunctionNames.has(declaration.name.text),
				);
			}
		}
	}

	return hooks.sort((a, b) => a.id.localeCompare(b.id));
}

export function isHookModule(file: string, srcDir: string) {
	const clean = file.split('?')[0] ?? file;
	if (path.dirname(clean) !== srcDir) return false;
	return /^hooks(\.server|\.client)?\.[jt]s$/.test(path.basename(clean));
}

export function transformHookModule(code: string, file: string, root: string) {
	const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const edits: Array<{ start: number; end: number; replacement: string }> = [];

	for (const statement of source.statements) {
		if (ts.isFunctionDeclaration(statement) && isExported(statement) && statement.name) {
			const name = statement.name.text;
			if (!hookFunctionNames.has(name)) continue;
			const start = statement.getStart(source);
			const end = statement.end;
			edits.push({
				start,
				end,
				replacement: `export const ${name} = __sveltekitDevtoolsTrackHook(${hookMeta(
					root,
					file,
					name,
				)}, ${withoutExportKeyword(code.slice(start, end))});`,
			});
		}

		if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
			const name = declaration.name.text;
			if (!hookFunctionNames.has(name)) continue;
			const start = declaration.initializer.getStart(source);
			const end = declaration.initializer.end;
			edits.push({
				start,
				end,
				replacement: `__sveltekitDevtoolsTrackHook(${hookMeta(root, file, name)}, ${code
					.slice(start, end)
					.trimEnd()})`,
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

async function existingHookFiles(srcDir: string) {
	const files = [
		'hooks.server.ts',
		'hooks.server.js',
		'hooks.client.ts',
		'hooks.client.js',
		'hooks.ts',
		'hooks.js',
	].map((file) => path.join(srcDir, file));

	const found = await Promise.all(
		files.map(async (file) => ((await fileExists(file)) ? file : null)),
	);
	return found.filter((file): file is string => Boolean(file));
}

function addHook(
	hooks: HookInfo[],
	root: string,
	file: string,
	environment: HookEnvironment,
	name: string,
	instrumented: boolean,
) {
	if (!hookExportNames.has(name)) return;
	hooks.push({
		id: `${slash(path.relative(root, file))}:${name}`,
		name,
		file: slash(path.relative(root, file)),
		environment,
		instrumented,
	});
}

function hookMeta(root: string, file: string, name: string) {
	return JSON.stringify({
		name,
		file: slash(path.relative(root, file)),
		environment: hookEnvironment(file),
	});
}

function hookEnvironment(file: string): HookEnvironment {
	const name = path.basename(file);
	if (name.includes('.server.')) return 'server';
	if (name.includes('.client.')) return 'client';
	return 'universal';
}

function isExported(node: ts.Node) {
	return Boolean(
		ts.canHaveModifiers(node) &&
		ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
	);
}

function withoutExportKeyword(value: string) {
	return value.replace(/^export\s+/, '');
}
