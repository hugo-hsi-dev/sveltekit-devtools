import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanServerRoutes } from '../src/node/server-routes';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-server-routes-${Date.now()}`);
	await mkdir(path.join(root, 'src/routes/api/[id]'), { recursive: true });
	await writeFile(
		path.join(root, 'src/routes/api/[id]/+server.ts'),
		`export async function GET() {}
		export const POST = async () => {};
		const PUT = async () => {};
		export { PUT };`,
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans SvelteKit server route methods', async () => {
	const routes = await scanServerRoutes({ root, routesDir: path.join(root, 'src/routes') });

	expect(routes).toEqual([
		{
			id: '/api/[id]',
			path: '/api/:id',
			file: 'src/routes/api/[id]/+server.ts',
			methods: ['GET', 'POST', 'PUT'],
		},
	]);
});
