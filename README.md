# SvelteKit Devtools

Devtools for SvelteKit apps, built as a Vite plugin.

This repo follows the Svelte repo shape: pnpm workspace, packages under `packages/*`,
playgrounds under `playgrounds/*`, Changesets for release metadata, and GitHub Actions
running install, format, typecheck, tests, and build.

## Packages

- `packages/sveltekit-devtools`: Vite plugin and devtools panel
- `playgrounds/basic`: SvelteKit app wired to this devtools plugin

## Try it

```sh
pnpm install
pnpm build
pnpm dev
```

Open the SvelteKit app, then click the Vite DevTools dock and choose SvelteKit.

## Features

- Route explorer for `src/routes`
- Load event timeline for `+page(.server).js/ts` and `+layout(.server).js/ts`,
  including returned data and `event.fetch` responses
- Components and remote function scanners
- SvelteKit form action scanner and same-origin action tester
- Vite Inspect view for module graph imports, importers, transforms, and HMR boundaries
- Tasks view for package scripts with captured one-shot output
- Vite DevTools Kit dock/RPC powered by `@vitejs/devtools`
