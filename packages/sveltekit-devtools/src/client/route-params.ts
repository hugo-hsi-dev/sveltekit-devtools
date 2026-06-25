export interface RoutePathParam {
	name: string;
	type: 'required' | 'optional' | 'rest';
}

export function routePathParams(path: string): RoutePathParam[] {
	return path
		.split('/')
		.flatMap((segment) => {
			if (segment.startsWith(':')) {
				const optional = segment.endsWith('?');
				return [
					{
						name: segment.slice(1, optional ? -1 : undefined),
						type: optional ? 'optional' : 'required',
					},
				];
			}

			if (segment.startsWith('*')) return [{ name: segment.slice(1), type: 'rest' }];

			return [];
		})
		.filter((param) => param.name);
}

export function defaultRouteParamValue(param: RoutePathParam) {
	return param.type === 'rest' ? `${param.name}/example` : param.name;
}

export function fillRoutePath(path: string, values: Record<string, string>) {
	const parts = path.split('/').map((segment) => {
		if (segment.startsWith(':')) {
			const optional = segment.endsWith('?');
			const name = segment.slice(1, optional ? -1 : undefined);
			const value = values[name]?.trim();
			if (!value) return optional ? '' : segment;
			return encodeURIComponent(value);
		}

		if (segment.startsWith('*')) {
			const value = values[segment.slice(1)]?.trim();
			if (!value) return segment;
			return value
				.split('/')
				.filter(Boolean)
				.map((part) => encodeURIComponent(part))
				.join('/');
		}

		return segment;
	});

	return parts.filter((part, index) => index === 0 || part).join('/') || '/';
}
