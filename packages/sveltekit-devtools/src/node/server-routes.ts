import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';

import type { HttpMethod, ServerRouteInfo } from '../shared/types.js';
import { exists, slash, walkFiles } from './files.js';
import { routeIdFromFile, routePathFromId } from './routes.js';

interface ScanServerRoutesOptions {
	root: string;
	routesDir: string;
}

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const methodSet = new Set<string>(methods);

export async function scanServerRoutes({
	root,
	routesDir,
}: ScanServerRoutesOptions): Promise<ServerRouteInfo[]> {
	if (!(await exists(routesDir))) return [];

	const files = (await walkFiles(routesDir)).filter((file) =>
		/^\+server\.[jt]s$/.test(path.basename(file)),
	);
	const routes: ServerRouteInfo[] = [];

	for (const file of files) {
		const code = await readFile(file, 'utf-8');
		const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const id = routeIdFromFile(file, routesDir);

		routes.push({
			id,
			path: routePathFromId(id),
			file: slash(path.relative(root, file)),
			methods: exportedMethods(ast),
		});
	}

	return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function exportedMethods(ast: ts.SourceFile) {
	const found = new Set<HttpMethod>();

	for (const statement of ast.statements) {
		if (isExported(statement)) {
			if (ts.isFunctionDeclaration(statement) && statement.name)
				addMethod(found, statement.name.text);
			if (ts.isVariableStatement(statement)) {
				for (const declaration of statement.declarationList.declarations) {
					if (ts.isIdentifier(declaration.name)) addMethod(found, declaration.name.text);
				}
			}
		}

		if (ts.isExportDeclaration(statement) && statement.exportClause) {
			if (!ts.isNamedExports(statement.exportClause)) continue;
			for (const element of statement.exportClause.elements) addMethod(found, element.name.text);
		}
	}

	return methods.filter((method) => found.has(method));
}

function addMethod(found: Set<HttpMethod>, value: string) {
	if (methodSet.has(value)) found.add(value as HttpMethod);
}

function isExported(node: ts.Node) {
	return Boolean(
		ts.canHaveModifiers(node) &&
		ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
	);
}
