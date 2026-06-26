import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';

import type { RouteActionInfo } from '../shared/types.js';
import { exists, slash, walkFiles } from './files.js';
import { routeIdFromFile, routePathFromId } from './routes.js';

interface ScanRouteActionsOptions {
	root: string;
	routesDir: string;
}

export async function scanRouteActions({
	root,
	routesDir,
}: ScanRouteActionsOptions): Promise<RouteActionInfo[]> {
	if (!(await exists(routesDir))) return [];

	const files = (await walkFiles(routesDir)).filter((file) =>
		/^\+page\.server\.[jt]s$/.test(path.basename(file)),
	);
	const actions: RouteActionInfo[] = [];

	for (const file of files) {
		const code = await readFile(file, 'utf-8');
		const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const id = routeIdFromFile(file, routesDir);
		const routePath = routePathFromId(id);
		const names = actionNames(ast);

		for (const name of names) {
			actions.push({
				id: `${id}:${name}`,
				path: routePath,
				file: slash(path.relative(root, file)),
				name,
				default: name === 'default',
			});
		}
	}

	return actions.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));
}

function actionNames(ast: ts.SourceFile) {
	for (const statement of ast.statements) {
		if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'actions') continue;
			const initializer = declaration.initializer
				? unwrapExpression(declaration.initializer)
				: null;
			if (!initializer || !ts.isObjectLiteralExpression(initializer)) continue;
			return initializer.properties.flatMap(propertyName).sort();
		}
	}

	return [];
}

function unwrapExpression(node: ts.Expression): ts.Expression {
	if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node))
		return unwrapExpression(node.expression);
	return node;
}

function propertyName(property: ts.ObjectLiteralElementLike) {
	if (ts.isSpreadAssignment(property)) return [];
	const name = property.name;
	if (!name) return [];
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
		return [name.text];
	return [];
}

function isExported(node: ts.Node) {
	return Boolean(
		ts.canHaveModifiers(node) &&
		ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
	);
}
