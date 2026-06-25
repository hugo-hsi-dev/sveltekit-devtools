import { expect, test } from 'vitest';

import {
	addHookEvent,
	addRemoteCallEvent,
	clearLoadEvents,
	getHookEvents,
	getLoadEvents,
	getRemoteCallEvents,
	runtimeModuleCode,
} from '../src/node/state';

test('stores recent remote call events newest first', () => {
	addRemoteCallEvent({
		id: 'one',
		name: 'double',
		importPath: '/src/lib/math.remote.ts',
		status: 'success',
		startedAt: 1,
		duration: 4,
		input: '21',
		output: '42',
	});
	addRemoteCallEvent(
		{
			id: 'two',
			name: 'double',
			importPath: '/src/lib/math.remote.ts',
			status: 'error',
			startedAt: 2,
			duration: 3,
			input: 'bad',
			error: 'nope',
		},
		1,
	);

	expect(getRemoteCallEvents().map((event) => event.id)).toEqual(['two']);
});

test('stores recent hook events newest first', () => {
	addHookEvent({
		id: 'one',
		name: 'handle',
		file: 'src/hooks.server.ts',
		environment: 'server',
		status: 'success',
		startedAt: 1,
		duration: 4,
		url: '/',
	});
	addHookEvent(
		{
			id: 'two',
			name: 'handle',
			file: 'src/hooks.server.ts',
			environment: 'server',
			status: 'error',
			startedAt: 2,
			duration: 3,
			url: '/bad',
			error: 'nope',
		},
		1,
	);

	expect(getHookEvents().map((event) => event.id)).toEqual(['two']);
});

test('runtime load tracker captures event.fetch responses', async () => {
	clearLoadEvents();
	const module = await import(
		`data:text/javascript;base64,${Buffer.from(runtimeModuleCode(10)).toString('base64')}#${Date.now()}`
	);
	const load = module.__sveltekitDevtoolsTrackLoad(
		{ route: '/', file: 'src/routes/+page.ts' },
		async ({ fetch }: { fetch: typeof globalThis.fetch }) => {
			const response = await fetch('/api/echo');
			return { api: await response.json() };
		},
	);

	await load({
		url: new URL('http://localhost/items/42?q=one&q=two&page=1'),
		params: { id: 42 },
		fetch: async () => {
			const body = JSON.stringify({ message: 'ok' });
			return {
				status: 200,
				statusText: 'OK',
				headers: {
					get: () => {
						throw new Error('hidden header');
					},
				},
				clone: () => ({ text: async () => body }),
				json: async () => JSON.parse(body) as unknown,
			} as Response;
		},
	});

	expect(getLoadEvents()[0]).toMatchObject({
		route: '/',
		url: '/items/42?q=one&q=two&page=1',
		params: { id: '42' },
		query: { q: ['one', 'two'], page: ['1'] },
		status: 'success',
		fetches: [
			{
				url: '/api/echo',
				method: 'GET',
				status: 200,
				statusText: 'OK',
				response: { text: '{\n  "message": "ok"\n}' },
			},
		],
	});
});
