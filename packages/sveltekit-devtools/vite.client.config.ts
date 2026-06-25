import { defineConfig } from 'vite';

export default defineConfig({
	root: 'src/client',
	base: './',
	build: {
		emptyOutDir: true,
		outDir: '../../dist/client',
	},
});
