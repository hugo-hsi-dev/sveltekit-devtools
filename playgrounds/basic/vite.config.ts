import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { sveltekitDevtools } from 'sveltekit-devtools';

export default defineConfig({
	plugins: [sveltekitDevtools(), sveltekit()],
});
