import type { Actions } from './$types';

export const actions = {
	save: async ({ request }) => {
		const data = await request.formData();
		return {
			ok: true,
			note: String(data.get('note') ?? ''),
		};
	},
	preview: async ({ request }) => {
		const data = await request.formData();
		return {
			ok: true,
			name: String(data.get('name') ?? ''),
		};
	},
} satisfies Actions;
