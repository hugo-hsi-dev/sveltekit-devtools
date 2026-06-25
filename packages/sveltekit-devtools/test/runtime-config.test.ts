import { expect, test } from 'vitest';

import { scanRuntimeConfig } from '../src/node/runtime-config';

test('scans only Vite resolved runtime env', () => {
	const config = scanRuntimeConfig({
		mode: 'development',
		base: '/',
		envPrefix: ['PUBLIC_', 'VITE_'],
		env: {
			BASE_URL: '/',
			MODE: 'development',
			PUBLIC_API_URL: 'http://localhost:5173/api',
			VITE_FLAG: 'on',
		},
	});

	expect(config).toEqual({
		mode: 'development',
		base: '/',
		envPrefix: ['PUBLIC_', 'VITE_'],
		env: [
			{ name: 'BASE_URL', value: '/', exposed: true },
			{ name: 'MODE', value: 'development', exposed: true },
			{ name: 'PUBLIC_API_URL', value: 'http://localhost:5173/api', exposed: true },
			{ name: 'VITE_FLAG', value: 'on', exposed: true },
		],
	});
});
