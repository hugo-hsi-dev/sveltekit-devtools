/// <reference types="@vitejs/devtools-kit" />

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineRpcFunction } from '@vitejs/devtools-kit';
import type { Plugin, PluginOption, ResolvedConfig, ViteDevServer } from 'vite';

import type { DevtoolsState, LoadEvent, RemoteCallEvent } from '../shared/types.js';
import { scanRouteActions } from './actions.js';
import { scanAssets } from './assets.js';
import { idleBuildAnalysis, runBuildAnalyze, scanBuildOutput } from './build-analyze.js';
import { clientBridgeModuleCode } from './client-bridge.js';
import { dockModuleCode } from './dock.js';
import { scanComponents } from './components.js';
import { isHookModule, scanHooks, transformHookModule } from './hooks.js';
import { scanImports } from './imports.js';
import { transformLoadModule } from './load-transform.js';
import { scanModuleGraph } from './module-graph.js';
import { scanProject } from './project.js';
import { isRemoteModule, scanRemotes, transformRemoteModule } from './remotes.js';
import { cleanId, isRouteLoadModule, scanRoutes } from './routes.js';
import { scanRuntimeConfig } from './runtime-config.js';
import { scanServerRoutes } from './server-routes.js';
import {
	addLoadEvent,
	addHookEvent,
	addRemoteCallEvent,
	clearLoadEvents,
	getHookEvents,
	getLoadEvents,
	getRemoteCallEvents,
	runtimeModuleCode,
} from './state.js';
import { runTask, scanTasks } from './tasks.js';
import { scanVirtualFiles } from './virtual-files.js';

export interface SvelteKitDevtoolsOptions {
	base?: string;
	maxLoadEvents?: number;
	staticDir?: string;
	routesDir?: string;
	viteDevtools?: boolean;
}

const runtimeModuleId = 'virtual:sveltekit-devtools/runtime';
const resolvedRuntimeModuleId = `\0${runtimeModuleId}`;
const clientBridgeModuleId = 'virtual:sveltekit-devtools/client-bridge';
const resolvedClientBridgeModuleId = `\0${clientBridgeModuleId}`;
const dockModuleId = 'virtual:sveltekit-devtools/dock';
const resolvedDockModuleId = `\0${dockModuleId}`;
const clientDist = fileURLToPath(new URL('../client', import.meta.url));
const svelteKitClientApp = '/.svelte-kit/generated/client/app.js';
const require = createRequire(import.meta.url);
const viteDevtoolsClientInject = viteFsPath(require.resolve('@vitejs/devtools/client/inject'));

// The devframe dock renders an `icon` string as `<img src>` only when it looks like a
// URL/data-URI (otherwise it treats it as an Iconify `collection:name`, which the dock
// can't resolve offline — that's why a bare 'logos:svelte-icon' showed a generic glyph).
// Mirror Nuxt's approach (it passes an SVG URL) but inline as a self-contained data-URI.
const svelteLogoSvg =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 118"><path fill="#ff3e00" d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.9-1.6 8.9.5 18 5.7 25.3 11 15.7 32.6 20.3 48.2 10.4l27.5-17.5c7.5-4.7 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.9 1.6-8.9-.4-18.1-5.7-25.4"/><path fill="#fff" d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7L65.5 72c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 4-9.8 8.5-12.7l27.5-17.5c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.3-7.1-2.5-.6.2-1.2.4-1.7.7L32.4 46c-1.4.9-2.3 2.2-2.6 3.8-.3 1.6.1 3.3 1 4.6 1.6 2.3 4.4 3.3 7.1 2.5.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-4 9.8-8.5 12.7l-27.5 17.5c-1.7 1.1-3.6 1.9-5.6 2.5"/></svg>';
const svelteDockIcon = `data:image/svg+xml;base64,${Buffer.from(svelteLogoSvg).toString('base64')}`;

export function sveltekitDevtools(options: SvelteKitDevtoolsOptions = {}): PluginOption {
	return [
		options.viteDevtools === true ? viteDevtoolsPlugin() : null,
		sveltekitDevtoolsPlugin(options),
	];
}

function sveltekitDevtoolsPlugin(options: SvelteKitDevtoolsOptions = {}): Plugin {
	const base = normalizeBase(options.base ?? '/__sveltekit-devtools/');
	const maxLoadEvents = options.maxLoadEvents ?? 200;
	let config: ResolvedConfig;
	let routesDir = '';
	let staticDir = '';
	let srcDir = '';
	let generatedDir = '';
	let injectViteDevtools = false;
	let buildAnalysis = idleBuildAnalysis();
	let buildAnalysisPromise: Promise<DevtoolsState['buildAnalysis']> | null = null;
	let devServer: ViteDevServer | null = null;
	let taskRuns: DevtoolsState['taskRuns'] = [];
	const sseClients = new Set<ServerResponse>();

	function notifyClients() {
		for (const client of sseClients) {
			try {
				client.write('data: update\n\n');
			} catch {
				sseClients.delete(client);
			}
		}
	}

	async function readState(): Promise<DevtoolsState> {
		return {
			root: config.root,
			project: await scanProject({ root: config.root, vitePlugins: config.plugins }),
			runtimeConfig: scanRuntimeConfig(config),
			buildAnalysis:
				buildAnalysis.status === 'idle'
					? await scanBuildOutput({ root: config.root })
					: buildAnalysis,
			moduleGraph: scanModuleGraph({ root: config.root, moduleGraph: devServer?.moduleGraph }),
			tasks: await scanTasks(config.root),
			taskRuns,
			routes: await scanRoutes({ routesDir, root: config.root }),
			loads: getLoadEvents(),
			hooks: await scanHooks({ root: config.root, srcDir }),
			hookEvents: getHookEvents(),
			imports: await scanImports({ root: config.root, srcDir }),
			components: await scanComponents({ root: config.root, srcDir, routesDir }),
			remotes: await scanRemotes({ root: config.root, srcDir }),
			remoteCalls: getRemoteCallEvents(),
			serverRoutes: await scanServerRoutes({ root: config.root, routesDir }),
			routeActions: await scanRouteActions({ root: config.root, routesDir }),
			assets: await scanAssets({ root: config.root, staticDir }),
			virtualFiles: await scanVirtualFiles({ root: config.root, generatedDir }),
			generatedAt: Date.now(),
		};
	}

	return {
		name: 'sveltekit-devtools',
		enforce: 'pre',
		apply: 'serve',
		configResolved(resolved) {
			config = resolved;
			routesDir = path.resolve(config.root, options.routesDir ?? 'src/routes');
			staticDir = path.resolve(config.root, options.staticDir ?? 'static');
			srcDir = path.resolve(config.root, 'src');
			generatedDir = path.resolve(config.root, '.svelte-kit/generated');
			injectViteDevtools = config.plugins.some((plugin) => plugin.name.startsWith('vite:devtools'));
		},
		resolveId(id) {
			if (id === runtimeModuleId) return resolvedRuntimeModuleId;
			if (id === clientBridgeModuleId) return resolvedClientBridgeModuleId;
			if (id === dockModuleId) return resolvedDockModuleId;
			return null;
		},
		load(id) {
			if (id === resolvedRuntimeModuleId) return runtimeModuleCode(maxLoadEvents);
			if (id === resolvedClientBridgeModuleId) return clientBridgeModuleCode();
			if (id === resolvedDockModuleId) return dockModuleCode(base);
			return null;
		},
		transform(code, id) {
			const file = cleanId(id);
			if (file.endsWith(svelteKitClientApp)) {
				const imports = [`import(${JSON.stringify(clientBridgeModuleId)});`];
				if (injectViteDevtools) {
					imports.unshift(`import(${JSON.stringify(viteDevtoolsClientInject)});`);
				} else {
					imports.unshift(`import(${JSON.stringify(dockModuleId)});`);
				}
				return `${imports.join('\n')}\n${code}`;
			}
			if (isRemoteModule(file, srcDir)) return transformRemoteModule(code, file, config.root);
			if (isHookModule(file, srcDir)) return transformHookModule(code, file, config.root);
			if (!isRouteLoadModule(file, routesDir)) return null;
			return transformLoadModule(code, file, routesDir);
		},
		configureServer(server) {
			devServer = server;
			server.watcher.add(srcDir);
			server.watcher.add(routesDir);
			server.watcher.add(staticDir);
			server.watcher.add(generatedDir);
			server.middlewares.use(async (req, res, next) => {
				try {
					if (!req.url) return next();
					const url = new URL(req.url, 'http://localhost');
					if (!url.pathname.startsWith(base)) return next();

					if (url.pathname === `${base}api/state`) {
						return writeJson(res, 200, await readState());
					}

					if (url.pathname === `${base}api/events`) {
						res.writeHead(200, {
							'content-type': 'text/event-stream',
							'cache-control': 'no-cache',
							connection: 'keep-alive',
						});
						res.write('retry: 2000\n\n');
						sseClients.add(res);
						req.on('close', () => sseClients.delete(res));
						return;
					}

					if (url.pathname === `${base}api/load` && req.method === 'POST') {
						addLoadEvent(JSON.parse(await readBody(req)) as LoadEvent, maxLoadEvents);
						notifyClients();
						return writeJson(res, 200, { ok: true });
					}

					if (url.pathname === `${base}api/remote-call` && req.method === 'POST') {
						addRemoteCallEvent(JSON.parse(await readBody(req)) as RemoteCallEvent, maxLoadEvents);
						notifyClients();
						return writeJson(res, 200, { ok: true });
					}

					if (url.pathname === `${base}api/hook` && req.method === 'POST') {
						addHookEvent(
							JSON.parse(await readBody(req)) as DevtoolsState['hookEvents'][number],
							maxLoadEvents,
						);
						notifyClients();
						return writeJson(res, 200, { ok: true });
					}

					if (url.pathname === `${base}api/build-analyze` && req.method === 'POST') {
						if (!buildAnalysisPromise) {
							buildAnalysis = {
								status: 'running',
								startedAt: Date.now(),
								totalSize: 0,
								assets: [],
							};
							buildAnalysisPromise = runBuildAnalyze({ root: config.root })
								.then((result) => {
									buildAnalysis = result;
									return result;
								})
								.finally(() => {
									buildAnalysisPromise = null;
								});
						}
						return writeJson(res, 200, await buildAnalysisPromise);
					}

					if (url.pathname === `${base}api/tasks/run` && req.method === 'POST') {
						const body = JSON.parse(await readBody(req)) as { name?: string };
						const result = await runTask({ root: config.root, name: body.name ?? '' });
						taskRuns = [result, ...taskRuns].slice(0, maxLoadEvents);
						return writeJson(res, result.status === 'success' ? 200 : 400, result);
					}

					if (url.pathname === `${base}api/clear` && req.method === 'POST') {
						clearLoadEvents();
						return writeJson(res, 200, { ok: true });
					}

					if (url.pathname === `${base}api/open-in-editor` && req.method === 'POST') {
						const fetchSite = req.headers['sec-fetch-site'];
						if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
							return writeJson(res, 403, { ok: false, error: 'forbidden' });
						}
						const reqOrigin = req.headers.origin;
						if (reqOrigin && req.headers.host && new URL(reqOrigin).host !== req.headers.host) {
							return writeJson(res, 403, { ok: false, error: 'forbidden' });
						}
						if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
							return writeJson(res, 415, { ok: false, error: 'expected application/json' });
						}
						const body = JSON.parse(await readBody(req)) as {
							file?: string;
							line?: number;
							column?: number;
							editor?: string;
						};
						const file = body.file ?? '';
						if (!file) return writeJson(res, 400, { ok: false, error: 'missing file' });
						const abs = path.isAbsolute(file) ? file : path.resolve(config.root, file);
						try {
							const { default: launchEditor } = await import('launch-editor');
							launchEditor(
								`${abs}:${body.line ?? 1}:${body.column ?? 1}`,
								body.editor || undefined,
							);
							return writeJson(res, 200, { ok: true });
						} catch (error) {
							return writeJson(res, 500, {
								ok: false,
								error: error instanceof Error ? error.message : String(error),
							});
						}
					}

					return serveClient(req, res, server, base);
				} catch (error) {
					next(error as Error);
				}
			});
		},
		devtools: {
			setup(ctx) {
				ctx.views.hostStatic(base, clientDist);
				ctx.docks.register({
					id: 'sveltekit-devtools',
					title: 'SvelteKit DevTools',
					icon: svelteDockIcon,
					type: 'iframe',
					url: base,
				});

				ctx.rpc.register(
					defineRpcFunction({
						name: 'sveltekit-devtools:get-state',
						type: 'query',
						jsonSerializable: true,
						setup: () => ({
							handler: readState,
						}),
					}) as never,
				);

				ctx.rpc.register(
					defineRpcFunction({
						name: 'sveltekit-devtools:clear-loads',
						type: 'action',
						jsonSerializable: true,
						setup: () => ({
							handler: async () => {
								clearLoadEvents();
								return { ok: true };
							},
						}),
					}) as never,
				);
			},
		},
	};
}

export default sveltekitDevtools;

async function viteDevtoolsPlugin(): Promise<Plugin[]> {
	const { DevTools } = await import('@vitejs/devtools');
	return DevTools();
}

async function serveClient(
	req: IncomingMessage,
	res: ServerResponse,
	server: ViteDevServer,
	base: string,
) {
	const url = new URL(req.url ?? '/', 'http://localhost');
	const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
	const file = await resolveStaticFile(relative);

	if (!file) {
		res.statusCode = 404;
		res.end('SvelteKit Devtools client not built. Run pnpm build.');
		return;
	}

	res.setHeader('content-type', mimeType(file));
	createReadStream(file).pipe(res);
	server.watcher.add(file);
}

async function resolveStaticFile(relative: string) {
	const target = path.resolve(clientDist, relative);
	if (!target.startsWith(clientDist)) return null;

	try {
		const found = await stat(target);
		if (found.isFile()) return target;
	} catch {
		// fall through to SPA fallback
	}

	const index = path.join(clientDist, 'index.html');
	try {
		await stat(index);
		return index;
	} catch {
		return null;
	}
}

async function readBody(req: IncomingMessage) {
	let body = '';
	for await (const chunk of req) body += chunk;
	return body;
}

function writeJson(res: ServerResponse, status: number, data: unknown) {
	res.statusCode = status;
	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(data));
}

function normalizeBase(base: string) {
	return `/${base.replace(/^\/|\/$/g, '')}/`;
}

function mimeType(file: string) {
	if (file.endsWith('.html')) return 'text/html; charset=utf-8';
	if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
	if (file.endsWith('.css')) return 'text/css; charset=utf-8';
	if (file.endsWith('.svg')) return 'image/svg+xml';
	return 'application/octet-stream';
}

function slashPath(value: string) {
	return value.replaceAll(path.sep, '/');
}

function viteFsPath(value: string) {
	const normalized = slashPath(value);
	return normalized.startsWith('/') ? `/@fs${normalized}` : `/@fs/${normalized}`;
}
