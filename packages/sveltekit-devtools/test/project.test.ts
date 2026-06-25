import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanProject } from '../src/node/project';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-project-${Date.now()}`);
	await mkdir(root, { recursive: true });
	await writeFile(
		path.join(root, 'package.json'),
		JSON.stringify({
			name: 'demo',
			version: '1.2.3',
			packageManager: 'pnpm@11.0.0',
			dependencies: { '@sveltejs/kit': '^2.0.0' },
			devDependencies: { vite: '^7.0.0' },
		}),
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans project package and vite plugins', async () => {
	const project = await scanProject({
		root,
		vitePlugins: [{ name: 'vite:demo', enforce: 'pre', apply: 'serve' }],
	});

	expect(project.name).toBe('demo');
	expect(project.version).toBe('1.2.3');
	expect(project.packageManager).toBe('pnpm@11.0.0');
	expect(project.dependencies).toEqual([
		{ name: '@sveltejs/kit', version: '^2.0.0', type: 'dependency' },
		{ name: 'vite', version: '^7.0.0', type: 'devDependency' },
	]);
	expect(project.vitePlugins).toEqual([{ name: 'vite:demo', enforce: 'pre', apply: 'serve' }]);
});

test('falls back to parent package manager', async () => {
	const parent = path.dirname(root);
	await writeFile(
		path.join(parent, 'package.json'),
		JSON.stringify({ packageManager: 'pnpm@12.0.0' }),
	);
	await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'child' }));

	const project = await scanProject({ root, vitePlugins: [] });

	expect(project.packageManager).toBe('pnpm@12.0.0');
});
