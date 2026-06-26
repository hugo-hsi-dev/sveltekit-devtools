import type { SvelteKitRoute } from '../shared/types';

export interface RoutePathMatch {
	matched: boolean;
	params: Record<string, string>;
}

export function normalizeRouteInput(input: string) {
	const value = input.trim();
	const pathname = (value || '/').split(/[?#]/)[0] || '/';
	return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function matchRoutePath(routePath: string, input: string): RoutePathMatch {
	const pathname = normalizeRouteInput(input);
	const params: Record<string, string> = {};
	const routeSegments = routePath.split('/').filter(Boolean);
	const pathSegments = pathname.split('/').filter(Boolean);

	if (routeSegments.length === 0) return { matched: pathSegments.length === 0, params };

	let pathIndex = 0;
	for (const segment of routeSegments) {
		if (segment.startsWith('*')) {
			params[segment.slice(1)] = decodeURIComponent(pathSegments.slice(pathIndex).join('/'));
			pathIndex = pathSegments.length;
			continue;
		}

		const pathSegment = pathSegments[pathIndex];
		if (segment.startsWith(':') && segment.endsWith('?')) {
			if (pathSegment) {
				params[segment.slice(1, -1)] = decodeURIComponent(pathSegment);
				pathIndex += 1;
			}
			continue;
		}

		if (!pathSegment) return { matched: false, params: {} };

		const names: string[] = [];
		const pattern = segment
			.replace(/:[\w$]+\??/g, (part) => {
				names.push(part.slice(1, part.endsWith('?') ? -1 : undefined));
				return '\u0000PARAM\u0000';
			})
			.replace(/\*[\w$]+/g, (part) => {
				names.push(part.slice(1));
				return '\u0000REST\u0000';
			})
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			.replaceAll('\u0000PARAM\u0000', '([^/]+)')
			.replaceAll('\u0000REST\u0000', '([^/]*)');
		const match = new RegExp(`^${pattern}$`).exec(pathSegment);
		if (!match) return { matched: false, params: {} };
		names.forEach((name, index) => {
			params[name] = decodeURIComponent(match[index + 1] ?? '');
		});
		pathIndex += 1;
	}

	return {
		matched: pathIndex === pathSegments.length,
		params: pathIndex === pathSegments.length ? params : {},
	};
}

export function routeMatchesPath(routePath: string, input: string) {
	return matchRoutePath(routePath, input).matched;
}

export function matchedRoutes(routes: SvelteKitRoute[], input: string) {
	return routes.filter((route) => routeMatchesPath(route.path, input));
}
