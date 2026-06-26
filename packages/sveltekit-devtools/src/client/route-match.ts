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
	const routeSegments = routePath.split('/').filter(Boolean);
	const pathSegments = normalizeRouteInput(input).split('/').filter(Boolean);
	const matched = matchFrom(0, 0, {});
	return matched ? { matched: true, params: matched } : { matched: false, params: {} };

	function matchFrom(
		routeIndex: number,
		pathIndex: number,
		params: Record<string, string>,
	): Record<string, string> | null {
		if (routeIndex === routeSegments.length) {
			return pathIndex === pathSegments.length ? params : null;
		}

		const segment = routeSegments[routeIndex] ?? '';
		if (segment.startsWith('*')) {
			const value = safeDecode(pathSegments.slice(pathIndex).join('/'));
			return value === null ? null : { ...params, [segment.slice(1)]: value };
		}

		const pathSegment = pathSegments[pathIndex];
		if (segment.startsWith(':') && segment.endsWith('?')) {
			if (pathSegment) {
				const value = safeDecode(pathSegment);
				if (value !== null) {
					const consumed = matchFrom(routeIndex + 1, pathIndex + 1, {
						...params,
						[segment.slice(1, -1)]: value,
					});
					if (consumed) return consumed;
				}
			}
			return matchFrom(routeIndex + 1, pathIndex, params);
		}

		if (!pathSegment) return null;
		const matchedSegment = matchSegment(segment, pathSegment);
		if (!matchedSegment) return null;
		return matchFrom(routeIndex + 1, pathIndex + 1, { ...params, ...matchedSegment });
	}
}

function matchSegment(routeSegment: string, pathSegment: string): Record<string, string> | null {
	const names: string[] = [];
	const pattern = routeSegment
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
	if (!match) return null;

	const params: Record<string, string> = {};
	for (const [index, name] of names.entries()) {
		const value = safeDecode(match[index + 1] ?? '');
		if (value === null) return null;
		params[name] = value;
	}
	return params;
}

function safeDecode(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

export function routeMatchesPath(routePath: string, input: string) {
	return matchRoutePath(routePath, input).matched;
}

export function matchedRoutes(routes: SvelteKitRoute[], input: string) {
	return routes.filter((route) => routeMatchesPath(route.path, input));
}
