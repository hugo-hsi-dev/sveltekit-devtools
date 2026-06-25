import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanAssets } from '../src/node/assets';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-assets-${Date.now()}`);
	await mkdir(path.join(root, 'static/icons'), { recursive: true });
	await writeFile(path.join(root, 'static/robots.txt'), 'User-agent: *');
	await writeFile(path.join(root, 'static/icons/logo.svg'), '<svg />');
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans static assets', async () => {
	const assets = await scanAssets({ root, staticDir: path.join(root, 'static') });

	expect(assets.map((asset) => [asset.path, asset.url, asset.type, asset.preview])).toEqual([
		['static/icons/logo.svg', '/icons/logo.svg', 'image/svg+xml', 'image'],
		['static/robots.txt', '/robots.txt', 'text/plain', 'text'],
	]);
	expect(assets.every((asset) => asset.size > 0)).toBe(true);
});
