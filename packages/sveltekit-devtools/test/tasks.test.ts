import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { runTask, scanTasks } from '../src/node/tasks';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-tasks-${Date.now()}`);
	await mkdir(root, { recursive: true });
	await writeFile(
		path.join(root, 'package.json'),
		JSON.stringify({
			packageManager: 'npm@10.0.0',
			scripts: {
				ok: 'node -e "console.log(\'task-ok\')"',
				dev: 'vite --host 127.0.0.1',
			},
		}),
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans package scripts and marks long-running scripts disabled', async () => {
	const tasks = await scanTasks(root);

	expect(tasks).toEqual([
		{ name: 'ok', command: 'node -e "console.log(\'task-ok\')"', runnable: true },
		{
			name: 'dev',
			command: 'vite --host 127.0.0.1',
			runnable: false,
			reason: 'long-running script',
		},
	]);
});

test('runs one-shot package script and refuses long-running script', async () => {
	const ok = await runTask({ root, name: 'ok' });
	const blocked = await runTask({ root, name: 'dev' });

	expect(ok.status).toBe('success');
	expect(ok.command).toBe("npm run 'ok'");
	expect(ok.output).toContain('task-ok');
	expect(blocked.status).toBe('error');
	expect(blocked.error).toBe('long-running script');
});
