import type { LoadEvent, SvelteKitRoute } from '../shared/types';

export function routeLoadEvents(loads: LoadEvent[], route: SvelteKitRoute) {
	return loads.filter((event) => event.route === route.path);
}
