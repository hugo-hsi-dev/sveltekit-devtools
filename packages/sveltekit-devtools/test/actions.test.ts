import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanRouteActions } from '../src/node/actions';

let root: string;
let routesDir: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-actions-${Date.now()}`);
	routesDir = path.join(root, 'src/routes');
	await mkdir(path.join(routesDir, 'items/[id]'), { recursive: true });
	await writeFile(
		path.join(routesDir, '+page.server.ts'),
		`export const actions = {
	default: async () => ({ ok: true })
} satisfies Actions;`,
	);
	await writeFile(
		path.join(routesDir, 'items/[id]/+page.server.ts'),
		`export const actions = {
	save: async () => ({ ok: true }),
	"delete-item": async () => ({ ok: true })
};`,
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans SvelteKit page server actions', async () => {
	const actions = await scanRouteActions({ root, routesDir });

	expect(actions).toEqual([
		{
			id: '/:default',
			path: '/',
			file: 'src/routes/+page.server.ts',
			name: 'default',
			default: true,
		},
		{
			id: '/items/[id]:delete-item',
			path: '/items/:id',
			file: 'src/routes/items/[id]/+page.server.ts',
			name: 'delete-item',
			default: false,
		},
		{
			id: '/items/[id]:save',
			path: '/items/:id',
			file: 'src/routes/items/[id]/+page.server.ts',
			name: 'save',
			default: false,
		},
	]);
});
