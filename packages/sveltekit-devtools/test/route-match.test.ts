import { expect, test } from 'vitest';

import { matchRoutePath, matchedRoutes, routeMatchesPath } from '../src/client/route-match';
import type { SvelteKitRoute } from '../src/shared/types';

const route = (path: string): SvelteKitRoute => ({
	id: path,
	path,
	files: [],
	chain: [],
	options: [],
	hasPage: true,
	hasLayout: false,
	hasError: false,
	hasEndpoint: false,
	hasLoad: false,
});

test('matches static, dynamic, optional, rest, and unmatched paths', () => {
	expect(routeMatchesPath('/about', '/about')).toBe(true);
	expect(matchRoutePath('/blog/:slug', '/blog/hello').params).toEqual({ slug: 'hello' });
	expect(routeMatchesPath('/docs/:section?', '/docs')).toBe(true);
	expect(matchRoutePath('/docs/:section?', '/docs/api').params).toEqual({ section: 'api' });
	expect(matchRoutePath('/files/*path', '/files/a/b/c').params).toEqual({ path: 'a/b/c' });
	expect(routeMatchesPath('/blog/:slug', '/blog')).toBe(false);
});

test('returns matched route list', () => {
	expect(
		matchedRoutes([route('/'), route('/blog/:slug')], '/blog/post').map((item) => item.path),
	).toEqual(['/blog/:slug']);
});
