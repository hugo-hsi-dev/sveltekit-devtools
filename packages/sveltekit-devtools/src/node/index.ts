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
const clientDist = fileURLToPath(new URL('../client', import.meta.url));
const svelteKitClientApp = '/.svelte-kit/generated/client/app.js';
const require = createRequire(import.meta.url);
const viteDevtoolsClientInject = viteFsPath(require.resolve('@vitejs/devtools/client/inject'));

export function sveltekitDevtools(options: SvelteKitDevtoolsOptions = {}): PluginOption {
	return [
		options.viteDevtools === false ? null : viteDevtoolsPlugin(),
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
			return null;
		},
		load(id) {
			if (id === resolvedRuntimeModuleId) return runtimeModuleCode(maxLoadEvents);
			if (id === resolvedClientBridgeModuleId) return clientBridgeModuleCode();
			return null;
		},
		transform(code, id) {
			const file = cleanId(id);
			if (file.endsWith(svelteKitClientApp)) {
				const imports = [`import(${JSON.stringify(clientBridgeModuleId)});`];
				if (injectViteDevtools) {
					imports.unshift(`import(${JSON.stringify(viteDevtoolsClientInject)});`);
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

					if (url.pathname === `${base}api/load` && req.method === 'POST') {
						addLoadEvent(JSON.parse(await readBody(req)) as LoadEvent, maxLoadEvents);
						return writeJson(res, 200, { ok: true });
					}

					if (url.pathname === `${base}api/remote-call` && req.method === 'POST') {
						addRemoteCallEvent(JSON.parse(await readBody(req)) as RemoteCallEvent, maxLoadEvents);
						return writeJson(res, 200, { ok: true });
					}

					if (url.pathname === `${base}api/hook` && req.method === 'POST') {
						addHookEvent(
							JSON.parse(await readBody(req)) as DevtoolsState['hookEvents'][number],
							maxLoadEvents,
						);
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
					title: 'SvelteKit',
					icon: 'logos:svelte-icon',
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
