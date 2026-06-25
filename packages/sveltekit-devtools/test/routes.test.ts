import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { routePathFromId, scanRoutes } from '../src/node/routes';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-${Date.now()}`);
	await mkdir(path.join(root, 'src/routes/(app)/blog/[slug]'), { recursive: true });
	await mkdir(path.join(root, 'src/routes/items/[id]'), { recursive: true });
	await writeFile(path.join(root, 'src/routes/+page.svelte'), '');
	await writeFile(path.join(root, 'src/routes/+error.svelte'), '');
	await writeFile(
		path.join(root, 'src/routes/+layout.ts'),
		'export const prerender = true;\nexport const load = () => ({})',
	);
	await writeFile(
		path.join(root, 'src/routes/(app)/blog/[slug]/+page.ts'),
		"export const ssr = false;\nexport const trailingSlash = 'always';",
	);
	await writeFile(path.join(root, 'src/routes/items/[id]/+server.ts'), '');
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans SvelteKit routes', async () => {
	const routes = await scanRoutes({ root, routesDir: path.join(root, 'src/routes') });

	expect(routes.map((route) => route.path)).toEqual(['/', '/blog/:slug', '/items/:id']);
	expect(routes.find((route) => route.path === '/')?.hasLoad).toBe(true);
	expect(routes.find((route) => route.path === '/items/:id')?.hasEndpoint).toBe(true);
	expect(routes.find((route) => route.path === '/')?.options).toEqual([
		{
			name: 'prerender',
			value: 'true',
			file: 'src/routes/+layout.ts',
		},
	]);
	expect(routes.find((route) => route.path === '/blog/:slug')?.options).toEqual([
		{
			name: 'ssr',
			value: 'false',
			file: 'src/routes/(app)/blog/[slug]/+page.ts',
		},
		{
			name: 'trailingSlash',
			value: "'always'",
			file: 'src/routes/(app)/blog/[slug]/+page.ts',
		},
	]);
	expect(
		routes
			.find((route) => route.path === '/blog/:slug')
			?.chain.map((file) => [file.kind, file.path, file.inherited]),
	).toEqual([
		['layout-load', 'src/routes/+layout.ts', true],
		['error', 'src/routes/+error.svelte', true],
		['page-load', 'src/routes/(app)/blog/[slug]/+page.ts', false],
	]);
});

test('normalizes SvelteKit params', () => {
	expect(routePathFromId('/shop/[category]/[[page]]/[...rest]')).toBe(
		'/shop/:category/:page?/*rest',
	);
});
