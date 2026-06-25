import path from 'node:path';

import { expect, test } from 'vitest';

import { transformRemoteModule } from '../src/node/remotes';

const root = path.resolve('/project');
const file = path.join(root, 'src/lib/math.remote.ts');

test('wraps exported remote handlers', () => {
	const result = transformRemoteModule(
		`import { command, query as q } from '$app/server';

export const double = q('unchecked', async (value: number) => value * 2);
export const save = command('unchecked', function save(value: string) {
	return value;
});
const local = q('unchecked', async () => 'skip');`,
		file,
		root,
	);

	expect(result?.code).toContain('import { __sveltekitDevtoolsTrackRemote }');
	expect(result?.code).toContain('__sveltekitDevtoolsTrackRemote({"name":"double"');
	expect(result?.code).toContain('__sveltekitDevtoolsTrackRemote({"name":"save"');
	expect(result?.code).not.toContain('__sveltekitDevtoolsTrackRemote({"name":"local"');
});

test('ignores modules without exported remote handlers', () => {
	const result = transformRemoteModule(`export const value = 1;`, file, root);

	expect(result).toBeNull();
});
