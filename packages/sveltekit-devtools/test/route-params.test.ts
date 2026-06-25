import { expect, test } from 'vitest';

import { fillRoutePath, routePathParams } from '../src/client/route-params';

test('extracts normalized SvelteKit route params', () => {
	expect(routePathParams('/items/:id/:page?/*rest')).toEqual([
		{ name: 'id', type: 'required' },
		{ name: 'page', type: 'optional' },
		{ name: 'rest', type: 'rest' },
	]);
});

test('fills route params into a navigable path', () => {
	expect(fillRoutePath('/items/:id/:page?/*rest', { id: '42', rest: 'a/b' })).toBe('/items/42/a/b');
	expect(fillRoutePath('/items/:id', { id: 'item 42' })).toBe('/items/item%2042');
});
