import { expect, test } from 'vitest';

import {
	componentGraphEdges,
	filterComponents,
	routeComponentUsages,
} from '../src/client/route-components';
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

test('finds route component import chain', () => {
	const components: ComponentInfo[] = [
		{
			...base,
			name: '+page',
			file: 'src/routes/+page.svelte',
			kind: 'route',
			route: '/',
			imports: ['src/lib/Card.svelte'],
		},
		{ ...base, name: 'Card', file: 'src/lib/Card.svelte', imports: ['src/lib/Button.svelte'] },
		{ ...base, name: 'Button', file: 'src/lib/Button.svelte' },
		{
			...base,
			name: '+page',
			file: 'src/routes/about/+page.svelte',
			kind: 'route',
			route: '/about',
		},
	];

	expect(
		routeComponentUsages(components, '/').map((usage) => [usage.component.name, usage.depth]),
	).toEqual([
		['+page', 0],
		['Card', 1],
		['Button', 2],
	]);

	expect(componentGraphEdges(components).map((edge) => [edge.from.name, edge.to.name])).toEqual([
		['+page', 'Card'],
		['Card', 'Button'],
	]);

	expect(filterComponents(components, 'button').map((component) => component.name)).toEqual([
		'Button',
	]);
	expect(filterComponents(components, '/about').map((component) => component.route)).toEqual([
		'/about',
	]);
});
