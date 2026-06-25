import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanImports } from '../src/node/imports';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-imports-${Date.now()}`);
	await mkdir(path.join(root, 'src/lib'), { recursive: true });
	await mkdir(path.join(root, 'src/routes'), { recursive: true });
	await writeFile(path.join(root, 'src/lib/Card.svelte'), `<script>import './card.css';</script>`);
	await writeFile(
		path.join(root, 'src/routes/+page.ts'),
		`import type { PageLoad } from './$types';
import { page } from '$app/state';
import Card from '$lib/Card.svelte';
import { browser } from '$app/environment';
import confetti from 'canvas-confetti';
await import('../lib/Card.svelte');`,
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans source imports by specifier', async () => {
	const imports = await scanImports({ root, srcDir: path.join(root, 'src') });

	expect(imports.map((item) => [item.specifier, item.kind, item.importedBy])).toEqual([
		['../lib/Card.svelte', 'relative', ['src/routes/+page.ts']],
		['./$types', 'relative', ['src/routes/+page.ts']],
		['./card.css', 'asset', ['src/lib/Card.svelte']],
		['$app/environment', 'sveltekit', ['src/routes/+page.ts']],
		['$app/state', 'sveltekit', ['src/routes/+page.ts']],
		['$lib/Card.svelte', 'lib', ['src/routes/+page.ts']],
		['canvas-confetti', 'package', ['src/routes/+page.ts']],
	]);
});
