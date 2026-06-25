import { expect, test } from 'vitest';

import { routeLoadEvents } from '../src/client/route-loads';
import type { LoadEvent, SvelteKitRoute } from '../src/shared/types';

test('filters load events for a route', () => {
	const route = { path: '/items/:id' } as SvelteKitRoute;
	const loads = [
		{ id: 'one', route: '/', url: '/' },
		{ id: 'two', route: '/items/:id', url: '/items/1?q=a' },
		{ id: 'three', route: '/items/:id', url: '/items/2?q=b' },
	] as LoadEvent[];

	expect(routeLoadEvents(loads, route).map((event) => event.id)).toEqual(['two', 'three']);
});
