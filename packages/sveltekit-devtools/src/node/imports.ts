import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ImportInfo } from '../shared/types.js';
import { exists, slash, walkFiles } from './files.js';

interface ScanImportsOptions {
	root: string;
	srcDir: string;
}

const importPattern =
	/\bimport(?:\s+type)?[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const sourceExtensions = new Set(['.js', '.ts', '.svelte']);
const assetPattern = /\.(css|gif|jpg|jpeg|png|svg|webp|avif|json|md)$/i;

export async function scanImports({ root, srcDir }: ScanImportsOptions): Promise<ImportInfo[]> {
	if (!(await exists(srcDir))) return [];

	const files = (await walkFiles(srcDir)).filter((file) =>
		sourceExtensions.has(path.extname(file)),
	);
	const imports = new Map<string, ImportInfo>();

	for (const file of files) {
		const source = await readFile(file, 'utf-8');
		const owner = slash(path.relative(root, file));
		for (const specifier of extractImports(source)) {
			const current = imports.get(specifier) ?? {
				id: specifier,
				specifier,
				kind: importKind(specifier),
				importedBy: [],
			};
			current.importedBy.push(owner);
			imports.set(specifier, current);
		}
	}

	return [...imports.values()]
		.map((item) => ({ ...item, importedBy: [...new Set(item.importedBy)].sort() }))
		.sort((a, b) => a.specifier.localeCompare(b.specifier));
}

function extractImports(source: string) {
	return [...source.matchAll(importPattern)]
		.map((match) => match[1] ?? match[2] ?? match[3] ?? '')
		.filter(Boolean);
}

function importKind(specifier: string): ImportInfo['kind'] {
	if (
		specifier.startsWith('$app/') ||
		specifier.startsWith('$env/') ||
		specifier === '@sveltejs/kit'
	) {
		return 'sveltekit';
	}
	if (specifier.startsWith('$lib/')) return 'lib';
	if (assetPattern.test(specifier)) return 'asset';
	if (specifier.startsWith('.')) return 'relative';
	return 'package';
}
