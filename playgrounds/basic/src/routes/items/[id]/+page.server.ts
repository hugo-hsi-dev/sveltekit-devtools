import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	await new Promise((resolve) => setTimeout(resolve, 140));
	return {
		item: {
			id: params.id,
			name: `Item ${params.id}`,
		},
	};
};
