import { expect, test } from 'vitest';

import { timelineEvents } from '../src/client/timeline';

test('combines runtime events newest first', () => {
	const events = timelineEvents({
		loads: [
			{
				id: 'load',
				route: '/',
				file: 'src/routes/+page.ts',
				url: '/?q=1',
				source: 'server',
				status: 'success',
				startedAt: 2,
				duration: 12,
				dataKeys: ['data'],
			},
		],
		remoteCalls: [
			{
				id: 'remote',
				name: 'double',
				importPath: 'src/lib/math.remote.ts',
				status: 'success',
				startedAt: 3,
				duration: 4,
				input: '21',
			},
		],
		hookEvents: [
			{
				id: 'hook',
				name: 'handle',
				file: 'src/hooks.server.ts',
				environment: 'server',
				status: 'error',
				startedAt: 1,
				duration: 8,
				url: '/',
			},
		],
	});

	expect(events.map((event) => [event.kind, event.label, event.status])).toEqual([
		['remote', 'double', 'success'],
		['load', '/', 'success'],
		['hook', 'handle', 'error'],
	]);
});
