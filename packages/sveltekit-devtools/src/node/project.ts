import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Plugin } from 'vite';

import type { PackageDependencyInfo, ProjectInfo } from '../shared/types.js';

interface ScanProjectOptions {
	root: string;
	vitePlugins: readonly Plugin[];
}

type PackageJson = {
	name?: string;
	version?: string;
	packageManager?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
};

export async function scanProject({ root, vitePlugins }: ScanProjectOptions): Promise<ProjectInfo> {
	const pkg = await readPackageJson(root);

	return {
		name: pkg.name ?? path.basename(root),
		version: pkg.version ?? '0.0.0',
		packageManager: pkg.packageManager ?? (await findPackageManager(root)),
		dependencies: dependencies(pkg),
		vitePlugins: vitePlugins.map((plugin) => ({
			name: plugin.name,
			enforce: plugin.enforce ?? 'normal',
			apply: typeof plugin.apply === 'function' ? 'function' : (plugin.apply ?? 'serve+build'),
		})),
	};
}

async function findPackageManager(root: string): Promise<string> {
	let dir = path.dirname(root);
	while (dir !== path.dirname(dir)) {
		const pkg = await readPackageJson(dir);
		if (pkg.packageManager) return pkg.packageManager;
		dir = path.dirname(dir);
	}
	return '';
}

async function readPackageJson(root: string): Promise<PackageJson> {
	try {
		return JSON.parse(await readFile(path.join(root, 'package.json'), 'utf-8')) as PackageJson;
	} catch {
		return {};
	}
}

function dependencies(pkg: PackageJson): PackageDependencyInfo[] {
	return [
		...dependencyEntries(pkg.dependencies, 'dependency'),
		...dependencyEntries(pkg.devDependencies, 'devDependency'),
		...dependencyEntries(pkg.peerDependencies, 'peerDependency'),
	].sort((a, b) => a.name.localeCompare(b.name));
}

function dependencyEntries(
	source: Record<string, string> | undefined,
	type: PackageDependencyInfo['type'],
) {
	return Object.entries(source ?? {}).map(([name, version]) => ({ name, version, type }));
}
