import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { walkFiles } from '../src/node/files';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-files-${Date.now()}`);
	await mkdir(path.join(root, 'real/nested'), { recursive: true });
	await writeFile(path.join(root, 'real/nested/file.txt'), 'ok');
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('walkFiles follows symlinked directories without cycling', async () => {
	try {
		await symlink(path.join(root, 'real'), path.join(root, 'link'), 'dir');
		await symlink(root, path.join(root, 'real/self'), 'dir');
	} catch {
		return;
	}

	const files = (await walkFiles(root)).map((file) => path.relative(root, file));

	expect(files).toHaveLength(1);
	expect(files[0]?.replaceAll(path.sep, '/')).toMatch(/^(real|link)\/nested\/file\.txt$/);
});
