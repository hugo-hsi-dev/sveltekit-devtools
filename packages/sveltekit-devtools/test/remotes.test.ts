import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanRemotes } from '../src/node/remotes';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-remotes-${Date.now()}`);
	await mkdir(path.join(root, 'src/lib/server'), { recursive: true });
	await mkdir(path.join(root, 'src/routes'), { recursive: true });
	await writeFile(
		path.join(root, 'src/lib/math.remote.ts'),
		`import { command, form, query as q } from '$app/server';

		export const double = q('unchecked', async (value: number) => value * 2);
		export const batchDouble = q.batch('unchecked', async (values: number[]) => {
			return (value: number) => value * 2;
		});
		export const save = command('unchecked', async (value: string) => value);
		export const submit = form(async () => ({ ok: true }));
		const local = q(async () => 'not exported');`,
	);
	await writeFile(
		path.join(root, 'src/lib/server/private.remote.ts'),
		`import { query } from '$app/server';
		export const hidden = query(async () => 'hidden');`,
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans exported remote functions outside src/lib/server', async () => {
	const remotes = await scanRemotes({ root, srcDir: path.join(root, 'src') });

	expect(remotes.map((remote) => `${remote.name}:${remote.kind}:${remote.validator}`)).toEqual([
		'batchDouble:query.batch:unchecked',
		'double:query:unchecked',
		'save:command:unchecked',
		'submit:form:none',
	]);
	expect(remotes.find((remote) => remote.name === 'submit')?.callable).toBe(false);
	expect(remotes.every((remote) => remote.file.startsWith('src/lib/math.remote.ts'))).toBe(true);
	expect(remotes.every((remote) => remote.importPath.startsWith('/@fs/'))).toBe(true);
	expect(remotes.every((remote) => !remote.importPath.startsWith('/@fs//'))).toBe(true);
});
