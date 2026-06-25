import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { ComponentInfo } from '../shared/types.js';
import { routeIdFromDir, routePathFromId } from './routes.js';

interface ScanComponentsOptions {
	root: string;
	srcDir: string;
	routesDir: string;
}

export async function scanComponents({
	root,
	srcDir,
	routesDir,
}: ScanComponentsOptions): Promise<ComponentInfo[]> {
	if (!(await exists(srcDir))) return [];

	const files = (await walk(srcDir)).filter((file) => file.endsWith('.svelte'));
	const importsByFile = new Map<string, string[]>();
	const components: ComponentInfo[] = [];

	for (const file of files) {
		const source = await readFile(file, 'utf-8');
		const imports = resolveSvelteImports(file, source, root);
		importsByFile.set(file, imports);
		components.push({
			name: componentName(file),
			file: slash(path.relative(root, file)),
			kind: isInside(routesDir, file) ? 'route' : 'component',
			route: isInside(routesDir, file)
				? routePathFromId(routeIdFromDir(path.dirname(file), routesDir))
				: undefined,
			props: extractProps(source),
			imports: imports.map((item) => slash(path.relative(root, item))),
			usedBy: [],
			hasModuleScript: /<script\b[^>]*\bmodule\b/.test(source),
			hasInstanceScript: /<script\b(?![^>]*\bmodule\b)/.test(source),
			hasStyle: /<style\b/.test(source),
		});
	}

	const byFile = new Map(
		components.map((component) => [path.resolve(root, component.file), component]),
	);
	for (const [owner, imports] of importsByFile) {
		for (const imported of imports) {
			const component = byFile.get(imported);
			if (!component) continue;
			component.usedBy.push(slash(path.relative(root, owner)));
		}
	}

	return components
		.map((component) => ({ ...component, usedBy: component.usedBy.sort() }))
		.sort((a, b) => a.file.localeCompare(b.file));
}

function extractProps(source: string) {
	const props = new Set<string>();
	for (const match of source.matchAll(/\bexport\s+let\s+([A-Za-z_$][\w$]*)/g)) {
		props.add(match[1] ?? '');
	}

	for (const match of source.matchAll(/\{([^}]+)\}\s*(?::[^=]+)?=\s*\$props\s*\(/g)) {
		for (const part of (match[1] ?? '').split(',')) {
			const name = part.trim().match(/^([A-Za-z_$][\w$]*)/)?.[1];
			if (name) props.add(name);
		}
	}

	return [...props].filter(Boolean).sort();
}

function resolveSvelteImports(file: string, source: string, root: string) {
	const imports: string[] = [];
	for (const match of source.matchAll(/\bimport\s+[^'"]*['"]([^'"]+\.svelte)['"]/g)) {
		const specifier = match[1];
		if (!specifier) continue;
		const resolved = resolveImport(file, specifier, root);
		if (resolved) imports.push(resolved);
	}
	return imports;
}

function resolveImport(file: string, specifier: string, root: string) {
	if (specifier.startsWith('$lib/')) {
		return path.resolve(root, 'src/lib', specifier.slice('$lib/'.length));
	}

	if (specifier.startsWith('.')) {
		return path.resolve(path.dirname(file), specifier);
	}

	return null;
}

function componentName(file: string) {
	const name = path.basename(file, '.svelte');
	if (name.startsWith('+')) return name;
	return name
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => part[0]?.toUpperCase() + part.slice(1))
		.join('');
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
