import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanVirtualFiles } from '../src/node/virtual-files';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-virtual-files-${Date.now()}`);
	await mkdir(path.join(root, '.svelte-kit/generated/client'), { recursive: true });
	await mkdir(path.join(root, '.svelte-kit/generated/client-optimized'), { recursive: true });
	await mkdir(path.join(root, '.svelte-kit/generated/server'), { recursive: true });
	await writeFile(path.join(root, '.svelte-kit/generated/client/app.js'), 'export const app = 1;');
	await writeFile(
		path.join(root, '.svelte-kit/generated/client-optimized/app.js'),
		'export const fast = 1;',
	);
	await writeFile(path.join(root, '.svelte-kit/generated/server/internal.js'), 'x'.repeat(12));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans SvelteKit generated virtual files', async () => {
	const files = await scanVirtualFiles({ root, maxTextLength: 10 });

	expect(files.map((file) => [file.path, file.kind, file.text, file.truncated])).toEqual([
		['.svelte-kit/generated/client-optimized/app.js', 'client', 'export con', true],
		['.svelte-kit/generated/client/app.js', 'client', 'export con', true],
		['.svelte-kit/generated/server/internal.js', 'server', 'xxxxxxxxxx', true],
	]);
	expect(files.every((file) => file.size > 0)).toBe(true);
});
