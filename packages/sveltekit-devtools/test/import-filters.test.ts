import { expect, test } from 'vitest';

import { filterImports, importKindCounts } from '../src/client/import-filters';
import type { ImportInfo } from '../src/shared/types';

const imports: ImportInfo[] = [
	{ id: 'a', specifier: '$app/state', kind: 'sveltekit', importedBy: ['src/routes/+page.ts'] },
	{ id: 'b', specifier: '$lib/Card.svelte', kind: 'lib', importedBy: ['src/routes/+page.ts'] },
	{ id: 'c', specifier: 'canvas-confetti', kind: 'package', importedBy: ['src/lib/fx.ts'] },
];

test('filters imports by kind and search query', () => {
	expect(filterImports(imports, { kind: 'lib' }).map((item) => item.specifier)).toEqual([
		'$lib/Card.svelte',
	]);
	expect(filterImports(imports, { query: 'fx' }).map((item) => item.specifier)).toEqual([
		'canvas-confetti',
	]);
	expect(importKindCounts(imports)).toMatchObject({ all: 3, sveltekit: 1, lib: 1, package: 1 });
});
