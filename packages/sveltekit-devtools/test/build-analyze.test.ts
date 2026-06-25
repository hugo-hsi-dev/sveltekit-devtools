import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanBuildOutput } from '../src/node/build-analyze';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-build-${Date.now()}`);
	await mkdir(path.join(root, '.svelte-kit/output/client/_app/immutable/chunks'), {
		recursive: true,
	});
	await mkdir(path.join(root, '.svelte-kit/output/client/_app/immutable/assets'), {
		recursive: true,
	});
	await writeFile(path.join(root, '.svelte-kit/output/client/index.html'), '<!doctype html>');
	await writeFile(
		path.join(root, '.svelte-kit/output/client/_app/immutable/chunks/app.js'),
		'console.log("hello");',
	);
	await writeFile(
		path.join(root, '.svelte-kit/output/client/_app/immutable/assets/app.css'),
		'body{color:red}',
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans SvelteKit build output by size', async () => {
	const analysis = await scanBuildOutput({ root });

	expect(analysis.status).toBe('success');
	expect(analysis.totalSize).toBeGreaterThan(0);
	expect(analysis.assets.map((asset) => [asset.path, asset.type])).toEqual([
		['.svelte-kit/output/client/_app/immutable/chunks/app.js', 'js'],
		['.svelte-kit/output/client/_app/immutable/assets/app.css', 'css'],
		['.svelte-kit/output/client/index.html', 'html'],
	]);
});

test('returns idle when no build output exists', async () => {
	await rm(path.join(root, '.svelte-kit/output'), { recursive: true, force: true });

	await expect(scanBuildOutput({ root })).resolves.toMatchObject({
		status: 'idle',
		assets: [],
		totalSize: 0,
	});
});
