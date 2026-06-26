import { expect, test } from 'vitest';

import { componentGraphData } from '../src/client/component-graph';
import type { ComponentInfo } from '../src/shared/types';

const base: ComponentInfo = {
	name: '',
	file: '',
	kind: 'component',
	props: [],
	imports: [],
	usedBy: [],
	hasModuleScript: false,
	hasInstanceScript: true,
	hasStyle: false,
};

test('creates component graph nodes and edges', () => {
	const data = componentGraphData([
		{
			...base,
			name: '+page',
			file: 'src/routes/+page.svelte',
			kind: 'route',
			route: '/',
			imports: ['src/lib/Card.svelte'],
		},
		{ ...base, name: 'Card', file: 'src/lib/Card.svelte' },
	]);

	expect(data.nodes.map((node) => [node.id, node.group])).toEqual([
		['src/lib/Card.svelte', 'component'],
		['src/routes/+page.svelte', 'route'],
	]);
	expect(data.edges).toEqual([
		{
			id: 'src/routes/+page.svelte->src/lib/Card.svelte',
			from: 'src/routes/+page.svelte',
			to: 'src/lib/Card.svelte',
		},
	]);
});
