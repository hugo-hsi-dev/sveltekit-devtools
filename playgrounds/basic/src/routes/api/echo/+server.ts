import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () => {
	return json({ message: 'hello from +server', method: 'GET' });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	return json({ message: 'hello from +server', method: 'POST', body });
};
