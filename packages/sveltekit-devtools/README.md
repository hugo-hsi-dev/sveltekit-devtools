# sveltekit-devtools

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { sveltekitDevtools } from 'sveltekit-devtools';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekitDevtools(), sveltekit()],
});
```

The plugin installs the Vite DevTools overlay and adds a SvelteKit dock. The dock
iframe is served by Vite middleware at `/__sveltekit-devtools/`; it is not a
SvelteKit page route.
