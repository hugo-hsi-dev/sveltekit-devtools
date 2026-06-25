import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { isHookModule, scanHooks, transformHookModule } from '../src/node/hooks';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-hooks-${Date.now()}`);
	await mkdir(path.join(root, 'src'), { recursive: true });
	await writeFile(
		path.join(root, 'src/hooks.server.ts'),
		`export async function handle({ event, resolve }) {
	return resolve(event);
}
export const handleFetch = ({ request, fetch }) => fetch(request);`,
	);
	await writeFile(path.join(root, 'src/hooks.ts'), `export const transport = {};`);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans SvelteKit hook exports', async () => {
	const hooks = await scanHooks({ root, srcDir: path.join(root, 'src') });

	expect(hooks.map((hook) => [hook.name, hook.file, hook.environment, hook.instrumented])).toEqual([
		['handle', 'src/hooks.server.ts', 'server', true],
		['handleFetch', 'src/hooks.server.ts', 'server', true],
		['transport', 'src/hooks.ts', 'universal', false],
	]);
});

test('wraps exported hook functions', () => {
	const file = path.join(root, 'src/hooks.server.ts');
	const result = transformHookModule(
		`export async function handle({ event, resolve }) {
	return resolve(event);
}
export const handleFetch = ({ request, fetch }) => fetch(request);
export const transport = {};`,
		file,
		root,
	);

	expect(isHookModule(file, path.join(root, 'src'))).toBe(true);
	expect(result?.code).toContain('import { __sveltekitDevtoolsTrackHook }');
	expect(result?.code).toContain('__sveltekitDevtoolsTrackHook({"name":"handle"');
	expect(result?.code).toContain('__sveltekitDevtoolsTrackHook({"name":"handleFetch"');
	expect(result?.code).not.toContain('__sveltekitDevtoolsTrackHook({"name":"transport"');
});
