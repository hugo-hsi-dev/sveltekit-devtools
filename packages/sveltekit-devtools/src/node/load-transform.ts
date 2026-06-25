import * as ts from 'typescript';

import { routeIdFromFile, routePathFromId } from './routes.js';

const importLine =
	"import { __sveltekitDevtoolsTrackLoad } from 'virtual:sveltekit-devtools/runtime';";

export function transformLoadModule(code: string, file: string, routesDir: string) {
	const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const edit = findLoadEdit(source, code);
	if (!edit) return null;

	const routeId = routeIdFromFile(file, routesDir);
	const meta = JSON.stringify({
		route: routePathFromId(routeId),
		file: file.replaceAll('\\', '/'),
	});

	let next = code.slice(0, edit.start) + edit.wrap(meta) + code.slice(edit.end);
	if (!next.includes('__sveltekitDevtoolsTrackLoad')) return null;
	if (!code.includes('virtual:sveltekit-devtools/runtime')) next = `${importLine}\n${next}`;

	return { code: next, map: null };
}

type Edit = {
	start: number;
	end: number;
	wrap: (meta: string) => string;
};

function findLoadEdit(source: ts.SourceFile, code: string): Edit | null {
	for (const statement of source.statements) {
		if (
			ts.isFunctionDeclaration(statement) &&
			isExported(statement) &&
			statement.name?.text === 'load'
		) {
			const start = statement.getStart(source);
			const end = statement.end;
			return {
				start,
				end,
				wrap: (meta) =>
					`export const load = __sveltekitDevtoolsTrackLoad(${meta}, ${withoutExportKeyword(
						code.slice(start, end),
					)});`,
			};
		}

		if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;

		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'load') continue;
			if (!declaration.initializer) continue;

			const start = declaration.initializer.getStart(source);
			const end = declaration.initializer.end;
			return {
				start,
				end,
				wrap: (meta) =>
					`__sveltekitDevtoolsTrackLoad(${meta}, ${code.slice(start, end).trimEnd()})`,
			};
		}
	}

	return null;
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
