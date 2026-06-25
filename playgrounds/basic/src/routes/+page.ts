import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	await new Promise((resolve) => setTimeout(resolve, 80));
	const api = (await fetch('/api/echo')).json();
	return {
		stats: {
			routes: 3,
			loads: 2,
		},
		api: await api,
	};
};
