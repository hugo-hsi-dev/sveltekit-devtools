import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { scanComponents } from '../src/node/components';

let root: string;

beforeEach(async () => {
	root = path.join(tmpdir(), `sveltekit-devtools-components-${Date.now()}`);
	await mkdir(path.join(root, 'src/lib'), { recursive: true });
	await mkdir(path.join(root, 'src/routes/about'), { recursive: true });
	await writeFile(
		path.join(root, 'src/lib/Card.svelte'),
		`<script lang="ts">
			export let title: string;
		</script>
		<slot />
		<style>.card { color: red; }</style>`,
	);
	await writeFile(
		path.join(root, 'src/routes/about/+page.svelte'),
		`<script lang="ts">
			import Card from '$lib/Card.svelte';
			interface Props {
				data: { title: string };
				enabled?: boolean;
				title?: string;
			}
			let { data, enabled: isEnabled = true, title = 'About' }: Props = $props();
		</script>
		<Card title={isEnabled ? title : data.title} />`,
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('scans Svelte components and import usage', async () => {
	const components = await scanComponents({
		root,
		srcDir: path.join(root, 'src'),
		routesDir: path.join(root, 'src/routes'),
	});

	const card = components.find((component) => component.file === 'src/lib/Card.svelte');
	const page = components.find((component) => component.file === 'src/routes/about/+page.svelte');

	expect(card?.props).toEqual(['title']);
	expect(card?.usedBy).toEqual(['src/routes/about/+page.svelte']);
	expect(card?.hasStyle).toBe(true);
	expect(page?.kind).toBe('route');
	expect(page?.route).toBe('/about');
	expect(page?.props).toEqual(['data', 'enabled', 'title']);
	expect(page?.imports).toEqual(['src/lib/Card.svelte']);
});
