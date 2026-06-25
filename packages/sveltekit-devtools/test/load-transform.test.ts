import path from 'node:path';

import { expect, test } from 'vitest';

import { transformLoadModule } from '../src/node/load-transform';

const routesDir = path.resolve('/project/src/routes');

test('wraps exported load function', () => {
	const file = path.join(routesDir, 'items/[id]/+page.ts');
	const result = transformLoadModule(
		`export async function load({ params }) {
	return { id: params.id };
}
`,
		file,
		routesDir,
	);

	expect(result?.code).toContain('import { __sveltekitDevtoolsTrackLoad }');
	expect(result?.code).toContain('export const load = __sveltekitDevtoolsTrackLoad');
	expect(result?.code).toContain('"route":"/items/:id"');
	expect(result?.code).toContain('async function load');
});

test('wraps exported load variable', () => {
	const file = path.join(routesDir, '+layout.ts');
	const result = transformLoadModule(
		`export const load = async () => ({ user: 'Ada' });`,
		file,
		routesDir,
	);

	expect(result?.code).toContain('__sveltekitDevtoolsTrackLoad({"route":"/"');
	expect(result?.code).toContain("async () => ({ user: 'Ada' })");
});

test('ignores modules without load export', () => {
	const file = path.join(routesDir, '+page.ts');
	const result = transformLoadModule(`export const prerender = true;`, file, routesDir);

	expect(result).toBeNull();
});
