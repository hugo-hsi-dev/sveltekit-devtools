import './style.css';

import type {
	AssetInfo,
	BuildAnalysis,
	ComponentInfo,
	DevtoolsState,
	HookEvent,
	HookInfo,
	ImportInfo,
	HttpMethod,
	LoadEvent,
	LoadFetchEvent,
	ModuleGraphInfo,
	ModuleGraphModuleInfo,
	PackageDependencyInfo,
	RemoteCallEvent,
	RemoteFunctionInfo,
	RouteActionInfo,
	RuntimeEnvVar,
	ServerRouteInfo,
	SeoMeta,
	SvelteKitRoute,
	SerializedValue,
	TaskRunEvent,
	TaskScriptInfo,
	VirtualFileInfo,
	VitePluginInfo,
} from '../shared/types';
import {
	componentGraphEdges,
	filterComponents,
	routeComponentUsages,
	type RouteComponentUsage,
} from './route-components';
import { routeLoadEvents } from './route-loads';
import {
	defaultRouteParamValue,
	fillRoutePath,
	routePathParams,
	type RoutePathParam,
} from './route-params';
import { bestSeoDescription, bestSeoImage, bestSeoTitle, missingSeoTags } from './seo';
import { isViewVisible, normalizeSettings, setHiddenView, type DevtoolsSettings } from './settings';
import { timelineEvents, type TimelineEvent } from './timeline';
import { icons, svelteLogo } from './shared/icons';
import { railEntries } from './shared/view-context';

type View =
	| 'overview'
	| 'routes'
	| 'loads'
	| 'timeline'
	| 'hooks'
	| 'imports'
	| 'plugins'
	| 'runtime-config'
	| 'build-analyze'
	| 'inspect'
	| 'tasks'
	| 'open-graph'
	| 'remotes'
	| 'server-routes'
	| 'actions'
	| 'assets'
	| 'components'
	| 'virtual-files'
	| 'settings';
type RemoteRunState = 'idle' | 'running' | 'success' | 'error';
type ServerRouteResult = {
	status: number;
	statusText: string;
	duration: number;
	headers: Record<string, string>;
	body: string;
	error?: string;
};
type ActionResult = {
	status: number;
	statusText: string;
	duration: number;
	body: string;
	error?: string;
};
type CommandItem = {
	id: string;
	label: string;
	group: string;
};

const statusEl = element('#status');
const routesListEl = element('#routes-list');
const overviewViewEl = element('#overview-view');
const routesViewEl = element('#routes-view');
const loadsViewEl = element('#loads-view');
const timelineViewEl = element('#timeline-view');
const hooksViewEl = element('#hooks-view');
const importsViewEl = element('#imports-view');
const pluginsViewEl = element('#plugins-view');
const runtimeConfigViewEl = element('#runtime-config-view');
const buildAnalyzeViewEl = element('#build-analyze-view');
const inspectViewEl = element('#inspect-view');
const tasksViewEl = element('#tasks-view');
const openGraphViewEl = element('#open-graph-view');
const remotesViewEl = element('#remotes-view');
const serverRoutesViewEl = element('#server-routes-view');
const actionsViewEl = element('#actions-view');
const assetsViewEl = element('#assets-view');
const componentsViewEl = element('#components-view');
const virtualFilesViewEl = element('#virtual-files-view');
const settingsViewEl = element('#settings-view');
const commandPaletteEl = element('#command-palette');
const searchEl = element<HTMLInputElement>('#route-search');
const railEl = element('#rail');
const viewTitleEl = element('#view-title');
const routesSidebarEl = element('#routes-sidebar');
const allViews: View[] = [
	'overview',
	'routes',
	'loads',
	'timeline',
	'hooks',
	'imports',
	'plugins',
	'runtime-config',
	'build-analyze',
	'inspect',
	'tasks',
	'open-graph',
	'remotes',
	'server-routes',
	'actions',
	'assets',
	'components',
	'virtual-files',
	'settings',
];
const configurableViews = allViews.filter((item) => item !== 'overview' && item !== 'settings');
const viewLabels: Record<View, string> = {
	overview: 'Overview',
	routes: 'Routes',
	loads: 'Load data',
	timeline: 'Timeline',
	hooks: 'Hooks',
	imports: 'Imports',
	plugins: 'Plugins',
	'runtime-config': 'Runtime config',
	'build-analyze': 'Build analyze',
	inspect: 'Inspect',
	tasks: 'Tasks',
	'open-graph': 'Open Graph',
	remotes: 'Remotes',
	'server-routes': 'Server routes',
	actions: 'Actions',
	assets: 'Assets',
	components: 'Components',
	'virtual-files': 'Virtual files',
	settings: 'Settings',
};
const settingsKey = 'sveltekit-devtools:settings';

let state: DevtoolsState = {
	root: '',
	project: {
		name: '',
		version: '',
		packageManager: '',
		dependencies: [],
		vitePlugins: [],
	},
	runtimeConfig: {
		mode: '',
		base: '',
		envPrefix: [],
		env: [],
	},
	buildAnalysis: {
		status: 'idle',
		startedAt: 0,
		totalSize: 0,
		assets: [],
	},
	moduleGraph: {
		totalModules: 0,
		transformedModules: 0,
		hmrBoundaries: 0,
		modules: [],
	},
	tasks: [],
	taskRuns: [],
	routes: [],
	loads: [],
	hooks: [],
	hookEvents: [],
	imports: [],
	components: [],
	remotes: [],
	remoteCalls: [],
	serverRoutes: [],
	routeActions: [],
	assets: [],
	virtualFiles: [],
	generatedAt: 0,
};
let selectedRoute = '';
let view: View = 'overview';
let rpcPromise: Promise<any | null> | undefined;
let remoteInputs: Record<string, string> = {};
let remoteResults: Record<string, { status: RemoteRunState; text: string }> = {};
let runningTasks: Record<string, boolean> = {};
let serverRouteBodies: Record<string, string> = {};
let serverRouteHeaders: Record<string, string> = {};
let serverRouteMethods: Record<string, HttpMethod> = {};
let serverRoutePaths: Record<string, string> = {};
let serverRouteResults: Record<string, ServerRouteResult> = {};
let actionInputs: Record<string, string> = {};
let actionResults: Record<string, ActionResult> = {};
let routeParamInputs: Record<string, Record<string, string>> = {};
let componentQuery = '';
let pauseAutoRefreshUntil = 0;
let seoMeta: SeoMeta | null = null;
let seoStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
let seoError = '';
let settings = loadSettings();
let paletteOpen = false;
let paletteQuery = '';

applySettings();
element('#open-command-palette').addEventListener('click', () => openPalette());
element('#refresh').addEventListener('click', () => refresh());
element('#clear-loads').addEventListener('click', async () => {
	pauseAutoRefresh();
	await clearLoads();
	await refresh();
});
searchEl.addEventListener('input', () => {
	pauseAutoRefresh();
	render();
});

document.addEventListener('click', (event) => {
	const tab = (event.target as Element | null)?.closest<HTMLButtonElement>('.tab[data-view]');
	if (tab) {
		pauseAutoRefresh();
		setView(tab.dataset.view as View);
		return;
	}

	const paletteClose = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-close-palette]',
	);
	if (paletteClose) {
		closePalette();
		return;
	}

	const paletteCommand = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-command]',
	);
	if (paletteCommand) {
		void runCommand(paletteCommand.dataset.command ?? '');
		return;
	}

	const runButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-run-remote]',
	);
	if (runButton) {
		pauseAutoRefresh();
		const remote = state.remotes.find((item) => item.id === runButton.dataset.runRemote);
		if (remote) void runRemote(remote);
		return;
	}

	const serverRouteButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-run-server-route]',
	);
	if (serverRouteButton) {
		pauseAutoRefresh();
		const route = state.serverRoutes.find(
			(item) => item.id === serverRouteButton.dataset.runServerRoute,
		);
		if (route) void runServerRoute(route);
		return;
	}

	const actionButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-run-action]',
	);
	if (actionButton) {
		pauseAutoRefresh();
		const action = state.routeActions.find((item) => item.id === actionButton.dataset.runAction);
		if (action) void runAction(action);
		return;
	}

	const openFileButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-open-file]',
	);
	if (openFileButton) {
		pauseAutoRefresh();
		void openSourceFile(openFileButton.dataset.openFile ?? '');
		return;
	}

	const openAssetButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-open-asset]',
	);
	if (openAssetButton) {
		pauseAutoRefresh();
		openAsset(openAssetButton.dataset.openAsset ?? '');
		return;
	}

	const openRouteButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-open-route]',
	);
	if (openRouteButton) {
		pauseAutoRefresh();
		const input = element<HTMLInputElement>('#route-open-path');
		openRoute(input.value);
		return;
	}

	const refreshSeoButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-refresh-seo]',
	);
	if (refreshSeoButton) {
		pauseAutoRefresh();
		void requestSeoMeta();
		return;
	}

	const buildAnalyzeButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-run-build-analyze]',
	);
	if (buildAnalyzeButton) {
		pauseAutoRefresh();
		void runBuildAnalyze();
		return;
	}

	const taskButton = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-run-task]',
	);
	if (taskButton) {
		pauseAutoRefresh();
		const task = state.tasks.find((item) => item.name === taskButton.dataset.runTask);
		if (task) void runTask(task);
	}
});

document.addEventListener('input', (event) => {
	const commandSearch = (event.target as Element | null)?.closest<HTMLInputElement>(
		'#command-search',
	);
	if (commandSearch) {
		paletteQuery = commandSearch.value;
		renderPalette();
		return;
	}

	const routeParam = (event.target as Element | null)?.closest<HTMLInputElement>(
		'input[data-route-param]',
	);
	if (routeParam) {
		pauseAutoRefresh();
		const route = state.routes.find((item) => item.id === routeParam.dataset.routeId);
		const name = routeParam.dataset.routeParam;
		if (route && name) {
			const values = routeParamValues(route);
			values[name] = routeParam.value;
			element<HTMLInputElement>('#route-open-path').value = fillRoutePath(route.path, values);
		}
		return;
	}

	const componentSearch = (event.target as Element | null)?.closest<HTMLInputElement>(
		'input[data-component-search]',
	);
	if (componentSearch) {
		pauseAutoRefresh();
		componentQuery = componentSearch.value;
		renderComponents();
		return;
	}

	const input = (event.target as Element | null)?.closest<HTMLTextAreaElement>(
		'textarea[data-remote]',
	);
	if (input) {
		pauseAutoRefresh();
		remoteInputs[input.dataset.remote ?? ''] = input.value;
		return;
	}

	const serverRoutePath = (event.target as Element | null)?.closest<HTMLInputElement>(
		'input[data-server-route-path]',
	);
	if (serverRoutePath) {
		pauseAutoRefresh();
		serverRoutePaths[serverRoutePath.dataset.serverRoutePath ?? ''] = serverRoutePath.value;
		return;
	}

	const serverRouteBody = (event.target as Element | null)?.closest<HTMLTextAreaElement>(
		'textarea[data-server-route-body]',
	);
	if (serverRouteBody) {
		pauseAutoRefresh();
		serverRouteBodies[serverRouteBody.dataset.serverRouteBody ?? ''] = serverRouteBody.value;
		return;
	}

	const serverRouteHeadersInput = (event.target as Element | null)?.closest<HTMLTextAreaElement>(
		'textarea[data-server-route-headers]',
	);
	if (serverRouteHeadersInput) {
		pauseAutoRefresh();
		serverRouteHeaders[serverRouteHeadersInput.dataset.serverRouteHeaders ?? ''] =
			serverRouteHeadersInput.value;
		return;
	}

	const actionInput = (event.target as Element | null)?.closest<HTMLTextAreaElement>(
		'textarea[data-action-input]',
	);
	if (actionInput) {
		pauseAutoRefresh();
		actionInputs[actionInput.dataset.actionInput ?? ''] = actionInput.value;
	}
});

document.addEventListener('change', (event) => {
	const settingView = (event.target as Element | null)?.closest<HTMLInputElement>(
		'input[data-setting-view]',
	);
	if (settingView) {
		settings = setHiddenView(settings, settingView.value, !settingView.checked, configurableViews);
		saveSettings();
		if (view === settingView.value && !settingView.checked) view = 'overview';
		render();
		return;
	}

	const settingScale = (event.target as Element | null)?.closest<HTMLSelectElement>(
		'select[data-setting-scale]',
	);
	if (settingScale) {
		settings = normalizeSettings(
			{ ...settings, scale: settingScale.value as DevtoolsSettings['scale'] },
			configurableViews,
		);
		saveSettings();
		render();
		return;
	}

	const settingCompact = (event.target as Element | null)?.closest<HTMLInputElement>(
		'input[data-setting-compact]',
	);
	if (settingCompact) {
		settings = normalizeSettings(
			{ ...settings, compact: settingCompact.checked },
			configurableViews,
		);
		saveSettings();
		render();
		return;
	}

	const method = (event.target as Element | null)?.closest<HTMLSelectElement>(
		'select[data-server-route-method]',
	);
	if (!method) return;

	pauseAutoRefresh();
	serverRouteMethods[method.dataset.serverRouteMethod ?? ''] = method.value as HttpMethod;
});

document.addEventListener('keydown', (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
		event.preventDefault();
		paletteOpen ? closePalette() : openPalette();
		return;
	}

	if (!paletteOpen) return;
	if (event.key === 'Escape') {
		event.preventDefault();
		closePalette();
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
		void runCommand(filteredCommands()[0]?.id ?? '');
	}
});

const initialHash = location.hash.slice(1) as View;
if (allViews.includes(initialHash) && isViewVisible(settings, initialHash)) {
	view = initialHash;
}

void refresh();
setInterval(() => {
	if (!document.hidden && Date.now() > pauseAutoRefreshUntil) void refresh(false);
}, 1800);

async function refresh(showLoading = true) {
	if (showLoading) setStatus('Loading', '');
	try {
		state = await readState();
		selectedRoute ||= state.routes[0]?.id ?? '';
		setStatus('Live', 'live');
		render();
	} catch (error) {
		setStatus(error instanceof Error ? error.message : 'Failed', 'error');
	}
}

async function readState(): Promise<DevtoolsState> {
	const rpc = await rpcClient();
	if (rpc) return rpc.call('sveltekit-devtools:get-state');

	const response = await fetch('/__sveltekit-devtools/api/state');
	if (!response.ok) throw new Error('Devtools API failed');
	return response.json();
}

async function clearLoads() {
	const rpc = await rpcClient();
	if (rpc) {
		await rpc.call('sveltekit-devtools:clear-loads');
		return;
	}
	await fetch('/__sveltekit-devtools/api/clear', { method: 'POST' });
}

async function rpcClient() {
	rpcPromise ??= (async () => {
		try {
			const { getDevToolsClientContext } = await import('@vitejs/devtools-kit/client');
			return getDevToolsClientContext()?.rpc ?? null;
		} catch {
			return null;
		}
	})();
	return rpcPromise;
}

function loadSettings() {
	try {
		return normalizeSettings(
			JSON.parse(localStorage.getItem(settingsKey) ?? 'null') as Partial<DevtoolsSettings> | null,
			configurableViews,
		);
	} catch {
		return normalizeSettings(null, configurableViews);
	}
}

function saveSettings() {
	localStorage.setItem(settingsKey, JSON.stringify(settings));
	applySettings();
}

function applySettings() {
	document.documentElement.style.setProperty('--devtools-font-size', `${settings.scale}%`);
	document.body.dataset.density = settings.compact ? 'compact' : 'comfortable';
}

function setView(next: View) {
	if (!isViewVisible(settings, next)) return;
	view = next;
	history.replaceState(null, '', `#${next}`);
	render();
	if (view === 'open-graph') void requestSeoMeta();
}

function openPalette() {
	paletteOpen = true;
	paletteQuery = '';
	renderPalette();
}

function closePalette() {
	paletteOpen = false;
	renderPalette();
}

function renderPalette() {
	commandPaletteEl.classList.toggle('hidden', !paletteOpen);
	if (!paletteOpen) {
		commandPaletteEl.innerHTML = '';
		return;
	}

	const commands = filteredCommands();
	commandPaletteEl.innerHTML = `<div class="palette-backdrop">
		<section class="palette-panel" role="dialog" aria-modal="true" aria-label="Command palette">
			<div class="palette-head">
				<input id="command-search" type="search" autocomplete="off" placeholder="Search commands" value="${escapeAttr(paletteQuery)}" />
				<button type="button" data-close-palette>Close</button>
			</div>
			<div class="palette-list">
				${
					commands
						.map(
							(command) => `<button type="button" data-command="${escapeAttr(command.id)}">
								<span>${escapeHtml(command.label)}</span>
								<small>${escapeHtml(command.group)}</small>
							</button>`,
						)
						.join('') || `<div class="empty small">No commands found</div>`
				}
			</div>
		</section>
	</div>`;

	const input = element<HTMLInputElement>('#command-search');
	input.focus();
	input.setSelectionRange(input.value.length, input.value.length);
}

function filteredCommands() {
	const query = paletteQuery.trim().toLowerCase();
	return commandItems()
		.filter(
			(command) =>
				!query ||
				command.label.toLowerCase().includes(query) ||
				command.group.toLowerCase().includes(query),
		)
		.slice(0, 30);
}

function commandItems(): CommandItem[] {
	return [
		...allViews
			.filter((item) => isViewVisible(settings, item))
			.map((item) => ({ id: `view:${item}`, label: viewLabels[item], group: 'View' })),
		...state.routes.map((route) => ({
			id: `route:${route.id}`,
			label: route.path,
			group: 'Route',
		})),
		{ id: 'action:refresh', label: 'Refresh data', group: 'Action' },
		{ id: 'action:clear-loads', label: 'Clear loads', group: 'Action' },
		{ id: 'action:build-analyze', label: 'Run build analyze', group: 'Action' },
		{ id: 'action:open-graph', label: 'Refresh Open Graph', group: 'Action' },
	];
}

async function runCommand(id: string) {
	if (!id) return;
	closePalette();

	if (id.startsWith('view:')) {
		setView(id.slice('view:'.length) as View);
		return;
	}

	if (id.startsWith('route:')) {
		selectedRoute = id.slice('route:'.length);
		setView('routes');
		return;
	}

	if (id === 'action:refresh') {
		await refresh();
		return;
	}

	if (id === 'action:clear-loads') {
		await clearLoads();
		await refresh();
		return;
	}

	if (id === 'action:build-analyze') {
		setView('build-analyze');
		await runBuildAnalyze();
		return;
	}

	if (id === 'action:open-graph') {
		setView('open-graph');
		await requestSeoMeta();
	}
}

function render() {
	applySettings();
	renderRail();
	renderRoutesList();
	routesSidebarEl.classList.toggle('hidden', view !== 'routes');
	overviewViewEl.classList.toggle('hidden', view !== 'overview');
	routesViewEl.classList.toggle('hidden', view !== 'routes');
	loadsViewEl.classList.toggle('hidden', view !== 'loads');
	timelineViewEl.classList.toggle('hidden', view !== 'timeline');
	hooksViewEl.classList.toggle('hidden', view !== 'hooks');
	importsViewEl.classList.toggle('hidden', view !== 'imports');
	pluginsViewEl.classList.toggle('hidden', view !== 'plugins');
	runtimeConfigViewEl.classList.toggle('hidden', view !== 'runtime-config');
	buildAnalyzeViewEl.classList.toggle('hidden', view !== 'build-analyze');
	inspectViewEl.classList.toggle('hidden', view !== 'inspect');
	tasksViewEl.classList.toggle('hidden', view !== 'tasks');
	openGraphViewEl.classList.toggle('hidden', view !== 'open-graph');
	remotesViewEl.classList.toggle('hidden', view !== 'remotes');
	serverRoutesViewEl.classList.toggle('hidden', view !== 'server-routes');
	actionsViewEl.classList.toggle('hidden', view !== 'actions');
	assetsViewEl.classList.toggle('hidden', view !== 'assets');
	componentsViewEl.classList.toggle('hidden', view !== 'components');
	virtualFilesViewEl.classList.toggle('hidden', view !== 'virtual-files');
	settingsViewEl.classList.toggle('hidden', view !== 'settings');
	renderOverview();
	renderRouteDetail();
	renderLoads();
	renderTimeline();
	renderHooks();
	renderImports();
	renderPlugins();
	renderRuntimeConfig();
	renderBuildAnalyze();
	renderInspect();
	renderTasks();
	renderOpenGraph();
	renderRemotes();
	renderServerRoutes();
	renderActions();
	renderAssets();
	renderComponents();
	renderVirtualFiles();
	renderSettings();
	renderPalette();
}

function renderRail() {
	if (!isViewVisible(settings, view)) view = 'overview';

	const tabs = railEntries
		.filter((entry) => isViewVisible(settings, entry.view))
		.map(
			(entry) =>
				`${entry.divider ? '<div class="rail-divider"></div>' : ''}<button class="rail-tab tab ${
					entry.view === view ? 'active' : ''
				}" type="button" data-view="${escapeAttr(entry.view)}" title="${escapeAttr(
					viewLabels[entry.view],
				)}" aria-label="${escapeAttr(viewLabels[entry.view])}">${icons[entry.view] ?? ''}</button>`,
		)
		.join('');

	railEl.innerHTML = `<div class="rail-logo">${svelteLogo}</div>
		${tabs}
		<div class="rail-spacer"></div>
		<div class="rail-footer">
			<button class="rail-tab tab ${
				view === 'settings' ? 'active' : ''
			}" type="button" data-view="settings" title="Settings" aria-label="Settings">${icons.settings}</button>
		</div>`;

	viewTitleEl.innerHTML = `${icons[view] ?? ''}<h1>${escapeHtml(viewLabels[view])}</h1>`;
}

function renderOverview() {
	const keyPackages = ['@sveltejs/kit', 'svelte', 'vite', 'sveltekit-devtools'];
	const deps = keyPackages
		.map((name) => state.project.dependencies.find((dep) => dep.name === name))
		.filter((dep): dep is PackageDependencyInfo => Boolean(dep));
	const plugins = state.project.vitePlugins.slice(0, 24);

	overviewViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>${escapeHtml(state.project.name || 'Project')}</h2>
			<p class="muted">${escapeHtml(state.root)}</p>
		</div>
		<span class="badge">${escapeHtml(state.project.version)}</span>
	</div>
	<div class="detail-grid">
		<article class="result-card">
			<h3>Project</h3>
			<div class="meta-list">
				${renderMetaRow('Package manager', state.project.packageManager || 'unknown')}
				${renderMetaRow('Routes', String(state.routes.length))}
				${renderMetaRow('Hooks', String(state.hooks.length))}
				${renderMetaRow('Load fetches', String(loadFetchCount()))}
				${renderMetaRow('Imports', String(state.imports.length))}
				${renderMetaRow('Env vars', String(state.runtimeConfig.env.length))}
				${renderMetaRow('Build size', formatBytes(state.buildAnalysis.totalSize))}
				${renderMetaRow('Components', String(state.components.length))}
				${renderMetaRow('Remote functions', String(state.remotes.length))}
				${renderMetaRow('Server routes', String(state.serverRoutes.length))}
				${renderMetaRow('Actions', String(state.routeActions.length))}
				${renderMetaRow('Virtual files', String(state.virtualFiles.length))}
				${renderMetaRow('Vite modules', String(state.moduleGraph.totalModules))}
				${renderMetaRow('Tasks', String(state.tasks.length))}
			</div>
		</article>
		<article class="result-card">
			<h3>Core packages</h3>
			<div class="meta-list">
				${
					deps.map((dep) => renderMetaRow(dep.name, `${dep.version} · ${dep.type}`)).join('') ||
					`<div class="empty small">No SvelteKit packages found</div>`
				}
			</div>
		</article>
	</div>
	<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Vite plugins</h3>
				<p class="muted">Plugins active in this dev server.</p>
			</div>
			<span class="badge">${state.project.vitePlugins.length} plugins</span>
		</div>
		<div class="detail-grid">
			${
				plugins.map((plugin) => renderVitePluginCard(plugin)).join('') ||
				`<div class="empty">No Vite plugins found</div>`
			}
		</div>
	</section>`;
}

function renderVitePluginCard(plugin: VitePluginInfo) {
	return `<article class="result-card compact-card">
		<h3>${escapeHtml(plugin.name)}</h3>
		<div class="meta-list">
			${renderMetaRow('Enforce', plugin.enforce)}
			${renderMetaRow('Apply', plugin.apply)}
		</div>
	</article>`;
}

function renderRoutesList() {
	const query = searchEl.value.trim().toLowerCase();
	const routes = state.routes.filter((route) => route.path.toLowerCase().includes(query));

	routesListEl.innerHTML =
		routes
			.map((route) => {
				const latest = latestLoad(route);
				return `<button class="route-row ${route.id === selectedRoute ? 'active' : ''}" type="button" data-route="${escapeAttr(
					route.id,
				)}">
				<span class="route-path">${escapeHtml(route.path)}</span>
				<span class="badge ${latest ? 'hot' : ''}">${latest ? `${latest.duration} ms` : route.files.length}</span>
			</button>`;
			})
			.join('') || `<div class="empty">No routes found</div>`;

	routesListEl.querySelectorAll<HTMLButtonElement>('.route-row').forEach((row) => {
		row.addEventListener('click', () => {
			selectedRoute = row.dataset.route ?? '';
			setView('routes');
		});
	});
}

function renderRouteDetail() {
	const route = state.routes.find((item) => item.id === selectedRoute);
	if (!route) {
		routesViewEl.innerHTML = `<div class="empty">No route selected</div>`;
		return;
	}

	const loads = routeLoadEvents(state.loads, route);
	const latest = loads[0];
	const components = routeComponentUsages(state.components, route.path);
	const params = routePathParams(route.path);
	const values = routeParamValues(route);
	const openPath = fillRoutePath(route.path, values);
	routesViewEl.innerHTML = `<article class="route-detail">
		<h2>${escapeHtml(route.path)}</h2>
		<p class="muted">${route.files.length} files · ${route.hasLoad ? 'load tracked' : 'no load export found'} · ${
			latest ? `${latest.duration} ms latest load` : 'no load calls yet'
		}</p>
		${renderRouteParams(route, params, values)}
		<div class="route-actions">
			<input id="route-open-path" type="text" value="${escapeAttr(openPath)}" aria-label="Route path" />
			<button type="button" data-open-route>Open route</button>
		</div>
		${renderRouteChain(route)}
		${renderRouteOptions(route)}
		<div class="file-grid">
			${route.files
				.map(
					(file) => `<div class="file-card">
						<div class="card-head">
							<strong>${escapeHtml(file.name)}</strong>
							<span class="badge ${file.server ? 'warn' : ''}">${escapeHtml(file.kind)}</span>
						</div>
						<p><code>${escapeHtml(file.path)}</code></p>
						<button type="button" data-open-file="${escapeAttr(file.path)}">Open file</button>
					</div>`,
				)
				.join('')}
		</div>
		${renderRouteComponents(components)}
		${renderRouteLoads(loads)}
	</article>`;
}

function renderRouteChain(route: SvelteKitRoute) {
	if (!route.chain.length) return '';

	return `<section class="route-components">
		<div class="section-head compact">
			<div>
				<h3>Route chain</h3>
				<p class="muted">Layouts, error boundaries, and leaf files used for this route.</p>
			</div>
			<span class="badge">${route.chain.length} files</span>
		</div>
		<div class="component-chain">
			${route.chain
				.map(
					(file, index) => `<div class="component-chain-row" style="margin-left:${index * 12}px">
						<div>
							<strong>${escapeHtml(file.name)}</strong>
							<p><code>${escapeHtml(file.path)}</code></p>
							<p class="muted">${file.inherited ? 'Inherited from' : 'Defined on'} ${escapeHtml(file.route)}</p>
						</div>
						<span class="badge ${file.inherited ? '' : 'hot'}">${escapeHtml(file.kind)}</span>
						<button type="button" data-open-file="${escapeAttr(file.path)}">Open file</button>
					</div>`,
				)
				.join('')}
		</div>
	</section>`;
}

function renderRouteOptions(route: SvelteKitRoute) {
	const options = route.options ?? [];
	if (options.length === 0) return '';

	return `<div class="detail-grid">
		<article class="result-card">
			<h3>Route options</h3>
			<div class="meta-list">
				${options.map((option) => renderMetaRow(option.name, `${option.value} · ${option.file}`)).join('')}
			</div>
		</article>
	</div>`;
}

function renderRouteParams(
	route: SvelteKitRoute,
	params: RoutePathParam[],
	values: Record<string, string>,
) {
	if (params.length === 0) return '';

	return `<div class="route-params">
		${params
			.map(
				(param) => `<label>
					<span>${escapeHtml(param.name)} <em>${escapeHtml(param.type)}</em></span>
					<input data-route-id="${escapeAttr(route.id)}" data-route-param="${escapeAttr(param.name)}" value="${escapeAttr(values[param.name] ?? '')}" />
				</label>`,
			)
			.join('')}
	</div>`;
}

function renderRouteComponents(usages: RouteComponentUsage[]) {
	if (usages.length === 0) return '';

	return `<section class="route-components">
		<div class="section-head compact">
			<div>
				<h3>Components used by route</h3>
				<p class="muted">Route Svelte files and local component imports.</p>
			</div>
			<span class="badge">${usages.length} components</span>
		</div>
		<div class="component-chain">
			${usages
				.map(
					({
						component,
						depth,
					}) => `<div class="component-chain-row" style="margin-left:${depth * 18}px">
						<div>
							<strong>${escapeHtml(component.name)}</strong>
							<p><code>${escapeHtml(component.file)}</code></p>
						</div>
						<span class="badge ${component.kind === 'route' ? 'hot' : ''}">${escapeHtml(component.kind)}</span>
						<button type="button" data-open-file="${escapeAttr(component.file)}">Open file</button>
					</div>`,
				)
				.join('')}
		</div>
	</section>`;
}

function renderRouteLoads(loads: LoadEvent[]) {
	if (loads.length === 0) return '';

	const max = Math.max(1, ...loads.map((event) => event.duration));
	return `<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Recent loads for this route</h3>
				<p class="muted">Keeps query variants and returned data together.</p>
			</div>
			<span class="badge">${loads.length} calls</span>
		</div>
		<div class="load-list">
			${loads.map((event) => renderLoadRow(event, max)).join('')}
		</div>
	</section>`;
}

function renderLoads() {
	const max = Math.max(1, ...state.loads.map((event) => event.duration));
	loadsViewEl.innerHTML = `<div class="loads-head">
		<div>
			<h2>Load data</h2>
			<p class="muted">Recent load calls from page and layout modules.</p>
		</div>
		<span class="badge">${state.loads.length} events</span>
	</div>
	<div class="load-list">
		${
			state.loads.map((event) => renderLoadRow(event, max)).join('') ||
			`<div class="empty">Visit routes to collect load data</div>`
		}
	</div>`;
}

function renderTimeline() {
	const events = timelineEvents(state);
	const max = Math.max(1, ...events.map((event) => event.duration));
	timelineViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Timeline</h2>
			<p class="muted">Runtime load, hook, and remote calls in one stream.</p>
		</div>
		<span class="badge">${events.length} events</span>
	</div>
	<div class="load-list">
		${
			events.map((event) => renderTimelineRow(event, max)).join('') ||
			`<div class="empty">Visit routes or run remote calls to collect events</div>`
		}
	</div>`;
}

function renderTimelineRow(event: TimelineEvent, max: number) {
	const width = Math.max(4, Math.round((event.duration / max) * 100));
	return `<article class="load-card">
		<div class="load-summary">
			<div>
				<strong>${escapeHtml(event.label)}</strong>
				<div class="muted">${new Date(event.startedAt).toLocaleTimeString()}</div>
			</div>
			<div>
				<code>${escapeHtml(event.detail)}</code>
				<div class="bar"><span style="width:${width}%"></span></div>
			</div>
			<div>
				<strong>${event.duration} ms</strong>
				<div class="muted">${escapeHtml(event.kind)}</div>
			</div>
			<span class="badge ${event.status === 'error' ? 'warn' : 'hot'}">${escapeHtml(event.status)}</span>
		</div>
	</article>`;
}

function renderHooks() {
	const max = Math.max(1, ...state.hookEvents.map((event) => event.duration));
	hooksViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Hooks</h2>
			<p class="muted">SvelteKit hooks from <code>src/hooks.server</code>, <code>src/hooks.client</code>, and <code>src/hooks</code>.</p>
		</div>
		<span class="badge">${state.hooks.length} hooks · ${state.hookEvents.length} calls</span>
	</div>
	<div class="detail-grid">
		${
			state.hooks.map((hook) => renderHookCard(hook)).join('') ||
			`<div class="empty">No SvelteKit hooks found</div>`
		}
	</div>
	<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Recent hook calls</h3>
				<p class="muted">Timing captured around exported hook functions.</p>
			</div>
			<span class="badge">${state.hookEvents.length} calls</span>
		</div>
		<div class="load-list">
			${
				state.hookEvents.map((event) => renderHookEvent(event, max)).join('') ||
				`<div class="empty">Visit app routes to collect hook calls</div>`
			}
		</div>
	</section>`;
}

function renderImports() {
	const groups = ['sveltekit', 'lib', 'package', 'relative', 'asset'] as const;
	importsViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Imports</h2>
			<p class="muted">Source imports grouped by specifier and importing files.</p>
		</div>
		<span class="badge">${state.imports.length} specifiers</span>
	</div>
	${groups
		.map((kind) =>
			renderImportGroup(
				kind,
				state.imports.filter((item) => item.kind === kind),
			),
		)
		.join('')}`;
}

function renderPlugins() {
	const groups: VitePluginInfo['enforce'][] = ['pre', 'normal', 'post'];
	pluginsViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Plugins</h2>
			<p class="muted">Vite plugins active in this SvelteKit dev server.</p>
		</div>
		<span class="badge">${state.project.vitePlugins.length} plugins</span>
	</div>
	${groups
		.map((enforce) =>
			renderPluginGroup(
				enforce,
				state.project.vitePlugins.filter((plugin) => plugin.enforce === enforce),
			),
		)
		.join('')}`;
}

function renderPluginGroup(enforce: VitePluginInfo['enforce'], plugins: VitePluginInfo[]) {
	if (plugins.length === 0) return '';

	return `<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(enforce)}</h3>
				<p class="muted">${plugins.length} plugins</p>
			</div>
		</div>
		<div class="detail-grid">
			${plugins.map((plugin) => renderVitePluginCard(plugin)).join('')}
		</div>
	</section>`;
}

function renderRuntimeConfig() {
	runtimeConfigViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Runtime config</h2>
			<p class="muted">Vite-exposed env and dev server runtime flags.</p>
		</div>
		<span class="badge">${state.runtimeConfig.env.length} vars</span>
	</div>
	<div class="detail-grid">
		<article class="result-card">
			<h3>App runtime</h3>
			<div class="meta-list">
				${renderMetaRow('Mode', state.runtimeConfig.mode || 'unknown')}
				${renderMetaRow('Base', state.runtimeConfig.base || '/')}
				${renderMetaRow('Env prefix', state.runtimeConfig.envPrefix.join(', ') || 'none')}
			</div>
		</article>
		<article class="result-card">
			<h3>Public env</h3>
			<div class="meta-list">
				${
					state.runtimeConfig.env.map((item) => renderRuntimeEnvRow(item)).join('') ||
					`<div class="empty small">No Vite env found</div>`
				}
			</div>
		</article>
	</div>`;
}

function renderBuildAnalyze() {
	const analysis = state.buildAnalysis;
	const canRun = analysis.status !== 'running';
	buildAnalyzeViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Build analyze</h2>
			<p class="muted">Run project build and inspect generated SvelteKit client assets.</p>
		</div>
		<button type="button" data-run-build-analyze ${canRun ? '' : 'disabled'}>${analysis.status === 'running' ? 'Building' : 'Run build'}</button>
	</div>
	<div class="detail-grid">
		<article class="result-card">
			<h3>Summary</h3>
			<div class="meta-list">
				${renderMetaRow('Status', analysis.status)}
				${renderMetaRow('Total size', formatBytes(analysis.totalSize))}
				${renderMetaRow('Assets', String(analysis.assets.length))}
				${renderMetaRow('Duration', analysis.duration ? `${analysis.duration} ms` : '-')}
				${renderMetaRow('Command', analysis.command ?? 'not run')}
			</div>
		</article>
		${renderBuildOutput(analysis)}
	</div>
	${renderBuildAssets(analysis)}`;
}

function renderInspect() {
	const graph = state.moduleGraph;
	inspectViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Inspect</h2>
			<p class="muted">Vite module graph from this dev server.</p>
		</div>
		<span class="badge">${graph.totalModules} modules</span>
	</div>
	<div class="detail-grid">
		<article class="result-card">
			<h3>Module graph</h3>
			<div class="meta-list">
				${renderMetaRow('Total modules', String(graph.totalModules))}
				${renderMetaRow('Shown', String(graph.modules.length))}
				${renderMetaRow('Transformed', String(graph.transformedModules))}
				${renderMetaRow('HMR boundaries', String(graph.hmrBoundaries))}
			</div>
		</article>
		<article class="result-card">
			<h3>By kind</h3>
			<div class="meta-list">
				${moduleKindRows(graph)}
			</div>
		</article>
	</div>
	<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Modules</h3>
				<p class="muted">Sorted by importers and import count.</p>
			</div>
		</div>
		<div class="load-list">
			${
				graph.modules.map((module) => renderModuleGraphModule(module, graph)).join('') ||
				`<div class="empty">Open app pages to populate the Vite module graph</div>`
			}
		</div>
	</section>`;
}

function moduleKindRows(graph: ModuleGraphInfo) {
	const kinds: ModuleGraphModuleInfo['kind'][] = [
		'source',
		'dependency',
		'virtual',
		'style',
		'asset',
	];
	return kinds
		.map((kind) =>
			renderMetaRow(kind, String(graph.modules.filter((module) => module.kind === kind).length)),
		)
		.join('');
}

function renderModuleGraphModule(module: ModuleGraphModuleInfo, graph: ModuleGraphInfo) {
	const maxEdges = Math.max(
		1,
		...graph.modules.map((item) => item.importers.length + item.importedModules.length),
	);
	const edges = module.importers.length + module.importedModules.length;
	const width = Math.max(4, Math.round((edges / maxEdges) * 100));
	const title = module.file || module.url || module.id;

	return `<article class="load-card">
		<div class="load-summary module-summary">
			<div>
				<strong>${escapeHtml(title)}</strong>
				<div class="muted">${escapeHtml(module.url)}</div>
			</div>
			<div>
				<code>${escapeHtml(module.id)}</code>
				<div class="bar"><span style="width:${width}%"></span></div>
			</div>
			<div>
				<strong>${module.importers.length} / ${module.importedModules.length}</strong>
				<div class="muted">in / out</div>
			</div>
			<div class="module-actions">
				<span class="badge ${module.kind === 'source' ? 'hot' : ''}">${escapeHtml(module.kind)}</span>
				${module.file ? `<button type="button" data-open-file="${escapeAttr(module.file)}">Open file</button>` : ''}
			</div>
		</div>
		<div class="detail-grid">
			${renderTextCard('Imported by', module.importers.join('\n') || 'none')}
			${renderTextCard('Imports', module.importedModules.join('\n') || 'none')}
			${renderTextCard(
				'HMR',
				[
					module.selfAccepting ? 'self accepting' : '',
					module.acceptedHmrDeps.length ? `deps: ${module.acceptedHmrDeps.join(', ')}` : '',
					module.acceptedHmrExports.length
						? `exports: ${module.acceptedHmrExports.join(', ')}`
						: '',
					module.transformed ? 'client transformed' : '',
					module.ssrTransformed ? 'ssr transformed' : '',
					module.lastHMRTimestamp
						? `last HMR: ${new Date(module.lastHMRTimestamp).toLocaleString()}`
						: '',
				]
					.filter(Boolean)
					.join('\n') || 'none',
			)}
		</div>
	</article>`;
}

function renderTasks() {
	tasksViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Tasks</h2>
			<p class="muted">Package scripts from this SvelteKit app.</p>
		</div>
		<span class="badge">${state.tasks.length} scripts · ${state.taskRuns.length} runs</span>
	</div>
	<div class="detail-grid">
		${
			state.tasks.map((task) => renderTaskCard(task)).join('') ||
			`<div class="empty">No package scripts found</div>`
		}
	</div>
	${renderTaskRuns()}`;
}

function renderTaskCard(task: TaskScriptInfo) {
	const running = runningTasks[task.name] === true;
	const disabled = running || !task.runnable;
	return `<article class="result-card">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(task.name)}</h3>
				<p class="muted">${escapeHtml(task.command)}</p>
			</div>
			<span class="badge ${task.runnable ? 'hot' : 'warn'}">${task.runnable ? 'runnable' : 'disabled'}</span>
		</div>
		<button type="button" data-run-task="${escapeAttr(task.name)}" ${disabled ? 'disabled' : ''}>${
			running ? 'Running' : 'Run'
		}</button>
		${task.reason ? `<p class="muted">${escapeHtml(task.reason)}</p>` : ''}
	</article>`;
}

function renderTaskRuns() {
	return `<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Recent runs</h3>
				<p class="muted">Latest one-shot task output.</p>
			</div>
			<span class="badge">${state.taskRuns.length} runs</span>
		</div>
		<div class="load-list">
			${
				state.taskRuns.map((run) => renderTaskRun(run)).join('') ||
				`<div class="empty">Run a task to capture output</div>`
			}
		</div>
	</section>`;
}

function renderTaskRun(run: TaskRunEvent) {
	const text = run.error ?? run.output ?? '';
	return `<article class="load-card">
		<div class="load-summary">
			<div>
				<strong>${escapeHtml(run.name)}</strong>
				<div class="muted">${new Date(run.startedAt).toLocaleTimeString()}</div>
			</div>
			<div>
				<code>${escapeHtml(run.command)}</code>
				<div class="bar"><span style="width:${Math.min(100, Math.max(4, run.duration ?? 0))}%"></span></div>
			</div>
			<div>
				<strong>${run.duration ?? 0} ms</strong>
				<div class="muted">task</div>
			</div>
			<span class="badge ${run.status === 'error' ? 'warn' : 'hot'}">${escapeHtml(run.status)}</span>
		</div>
		<pre class="json-view ${run.status === 'error' ? 'error-text' : ''}">${escapeHtml(text || '(no output)')}</pre>
	</article>`;
}

async function runTask(task: TaskScriptInfo) {
	runningTasks = { ...runningTasks, [task.name]: true };
	renderTasks();

	try {
		const response = await fetch('/__sveltekit-devtools/api/tasks/run', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: task.name }),
		});
		const result = (await response.json()) as TaskRunEvent;
		state = {
			...state,
			taskRuns: [result, ...state.taskRuns.filter((run) => run.id !== result.id)],
		};
	} catch (error) {
		const startedAt = Date.now();
		state = {
			...state,
			taskRuns: [
				{
					id: `${startedAt}:${task.name}`,
					name: task.name,
					command: task.command,
					status: 'error',
					startedAt,
					completedAt: startedAt,
					duration: 0,
					error: errorMessage(error),
				},
				...state.taskRuns,
			],
		};
	} finally {
		runningTasks = { ...runningTasks, [task.name]: false };
	}

	renderTasks();
}

function renderSettings() {
	settingsViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Settings</h2>
			<p class="muted">Personal panel preferences stored in this browser.</p>
		</div>
	</div>
	<div class="detail-grid">
		<article class="result-card">
			<h3>Interface</h3>
			<div class="tester">
				<label>
					<span class="muted">Scale</span>
					<select data-setting-scale>
						${['90', '100', '110']
							.map(
								(scale) =>
									`<option value="${scale}" ${settings.scale === scale ? 'selected' : ''}>${scale}%</option>`,
							)
							.join('')}
					</select>
				</label>
				<label class="check-row">
					<input type="checkbox" data-setting-compact ${settings.compact ? 'checked' : ''} />
					<span>Compact density</span>
				</label>
			</div>
		</article>
		<article class="result-card">
			<h3>Tabs</h3>
			<div class="settings-list">
				${configurableViews
					.map(
						(item) => `<label class="check-row">
							<input type="checkbox" data-setting-view value="${escapeAttr(item)}" ${isViewVisible(settings, item) ? 'checked' : ''} />
							<span>${escapeHtml(viewLabels[item])}</span>
						</label>`,
					)
					.join('')}
			</div>
		</article>
	</div>`;
}

function renderBuildOutput(analysis: BuildAnalysis) {
	const text = analysis.error ?? analysis.output ?? 'No build output yet';
	return `<article class="result-card">
		<h3>${analysis.status === 'error' ? 'Error' : 'Output'}</h3>
		<pre class="json-view ${analysis.status === 'error' ? 'error-text' : ''}">${escapeHtml(text)}</pre>
	</article>`;
}

function renderBuildAssets(analysis: BuildAnalysis) {
	return `<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Client assets</h3>
				<p class="muted">Largest files from <code>.svelte-kit/output/client</code>.</p>
			</div>
			<span class="badge">${formatBytes(analysis.totalSize)}</span>
		</div>
		<div class="load-list">
			${
				analysis.assets.map((asset) => renderBuildAsset(asset, analysis.totalSize)).join('') ||
				`<div class="empty">Run build analyze to collect assets</div>`
			}
		</div>
	</section>`;
}

function renderBuildAsset(asset: BuildAnalysis['assets'][number], total: number) {
	const width = total ? Math.max(4, Math.round((asset.size / total) * 100)) : 4;
	return `<article class="load-card">
		<div class="load-summary">
			<div>
				<strong>${escapeHtml(asset.path)}</strong>
				<div class="muted">${new Date(asset.mtime).toLocaleString()}</div>
			</div>
			<div>
				<code>${escapeHtml(asset.type)}</code>
				<div class="bar"><span style="width:${width}%"></span></div>
			</div>
			<div>
				<strong>${escapeHtml(formatBytes(asset.size))}</strong>
				<div class="muted">${total ? Math.round((asset.size / total) * 100) : 0}%</div>
			</div>
			<button type="button" data-open-file="${escapeAttr(asset.path)}">Open file</button>
		</div>
	</article>`;
}

async function runBuildAnalyze() {
	state = {
		...state,
		buildAnalysis: {
			status: 'running',
			startedAt: Date.now(),
			totalSize: 0,
			assets: [],
		},
	};
	renderBuildAnalyze();

	const response = await fetch('/__sveltekit-devtools/api/build-analyze', { method: 'POST' });
	if (!response.ok) throw new Error('Build analyze failed');
	state = {
		...state,
		buildAnalysis: (await response.json()) as BuildAnalysis,
	};
	renderBuildAnalyze();
}

function renderRuntimeEnvRow(item: RuntimeEnvVar) {
	return `<div class="meta-row">
		<span>${escapeHtml(item.name)}</span>
		<strong>${escapeHtml(item.value)} ${item.exposed ? '' : '(internal)'}</strong>
	</div>`;
}

function renderOpenGraph() {
	const missing = seoMeta ? missingSeoTags(seoMeta) : [];
	openGraphViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Open Graph</h2>
			<p class="muted">SEO tags from the current app page.</p>
		</div>
		<button type="button" data-refresh-seo>${seoStatus === 'loading' ? 'Reading' : 'Refresh page meta'}</button>
	</div>
	${
		seoStatus === 'error'
			? `<div class="empty">${escapeHtml(seoError)}</div>`
			: seoMeta
				? renderSeoMeta(seoMeta, missing)
				: `<div class="empty">Open this tab in the dock to inspect the app page</div>`
	}`;
}

function renderSeoMeta(meta: SeoMeta, missing: string[]) {
	const image = bestSeoImage(meta);
	return `<div class="detail-grid">
		<article class="result-card social-preview">
			${image ? `<img class="social-image" src="${escapeAttr(image)}" alt="" />` : `<div class="social-image muted">No image</div>`}
			<div>
				<p class="muted">${escapeHtml(meta.ogUrl || meta.canonical || meta.url)}</p>
				<h3>${escapeHtml(bestSeoTitle(meta))}</h3>
				<p>${escapeHtml(bestSeoDescription(meta) || 'No description')}</p>
			</div>
		</article>
		<article class="result-card">
			<h3>Current page</h3>
			<div class="meta-list">
				${renderMetaRow('Path', meta.pathname)}
				${renderMetaRow('Title', meta.title || 'missing')}
				${renderMetaRow('Description', meta.description || 'missing')}
				${renderMetaRow('Canonical', meta.canonical || 'missing')}
			</div>
		</article>
		<article class="result-card">
			<h3>Open Graph</h3>
			<div class="meta-list">
				${renderMetaRow('og:title', meta.ogTitle || 'missing')}
				${renderMetaRow('og:description', meta.ogDescription || 'missing')}
				${renderMetaRow('og:image', meta.ogImage || 'missing')}
				${renderMetaRow('og:type', meta.ogType || 'missing')}
			</div>
		</article>
		<article class="result-card">
			<h3>Missing tags</h3>
			<pre class="json-view">${escapeHtml(missing.length ? missing.join('\n') : 'No required tags missing')}</pre>
		</article>
	</div>`;
}

async function requestSeoMeta() {
	seoStatus = 'loading';
	renderOpenGraph();

	try {
		seoMeta =
			window.parent === window ? readSeoMetaFromDocument(document) : await readSeoMetaFromParent();
		seoStatus = 'ready';
		seoError = '';
	} catch (error) {
		seoStatus = 'error';
		seoError = errorMessage(error);
	}

	renderOpenGraph();
}

function readSeoMetaFromParent() {
	const requestId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

	return new Promise<SeoMeta>((resolve, reject) => {
		const timer = window.setTimeout(() => {
			window.removeEventListener('message', onMessage);
			reject(new Error('Page meta timed out'));
		}, 5000);

		function onMessage(event: MessageEvent) {
			if (event.origin !== location.origin) return;
			if (!event.data || event.data.type !== 'sveltekit-devtools:seo-meta-result') return;
			if (event.data.requestId !== requestId) return;

			window.clearTimeout(timer);
			window.removeEventListener('message', onMessage);
			resolve(event.data.meta as SeoMeta);
		}

		window.addEventListener('message', onMessage);
		window.parent.postMessage({ type: 'sveltekit-devtools:seo-meta', requestId }, location.origin);
	});
}

function readSeoMetaFromDocument(doc: Document): SeoMeta {
	return {
		url: location.href,
		pathname: location.pathname,
		title: doc.title,
		description: readMeta(doc, 'name', 'description'),
		canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
		ogTitle: readMeta(doc, 'property', 'og:title'),
		ogDescription: readMeta(doc, 'property', 'og:description'),
		ogImage: readMeta(doc, 'property', 'og:image'),
		ogUrl: readMeta(doc, 'property', 'og:url'),
		ogType: readMeta(doc, 'property', 'og:type'),
		twitterCard: readMeta(doc, 'name', 'twitter:card'),
		twitterTitle: readMeta(doc, 'name', 'twitter:title'),
		twitterDescription: readMeta(doc, 'name', 'twitter:description'),
		twitterImage: readMeta(doc, 'name', 'twitter:image'),
	};
}

function readMeta(doc: Document, attribute: 'name' | 'property', value: string) {
	return doc.querySelector(`meta[${attribute}="${value}"]`)?.getAttribute('content') ?? '';
}

function renderImportGroup(kind: ImportInfo['kind'], imports: ImportInfo[]) {
	if (imports.length === 0) return '';
	return `<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(kind)}</h3>
				<p class="muted">${imports.length} specifiers</p>
			</div>
		</div>
		<div class="detail-grid">
			${imports.map((item) => renderImportCard(item)).join('')}
		</div>
	</section>`;
}

function renderImportCard(item: ImportInfo) {
	return `<article class="result-card">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(item.specifier)}</h3>
				<p class="muted">${item.importedBy.length} files</p>
			</div>
			<span class="badge">${escapeHtml(item.kind)}</span>
		</div>
		<div class="meta-list">
			${item.importedBy.map((file) => renderMetaRow('Imported by', file)).join('')}
		</div>
	</article>`;
}

function renderHookCard(hook: HookInfo) {
	return `<article class="result-card">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(hook.name)}</h3>
				<p class="muted">${escapeHtml(hook.file)}</p>
			</div>
			<span class="badge ${hook.instrumented ? 'hot' : ''}">${escapeHtml(hook.environment)}</span>
		</div>
		<button type="button" data-open-file="${escapeAttr(hook.file)}">Open file</button>
		<div class="meta-list">
			${renderMetaRow('Timing', hook.instrumented ? 'enabled' : 'not a function')}
		</div>
	</article>`;
}

function renderHookEvent(event: HookEvent, max: number) {
	const width = Math.max(4, Math.round((event.duration / max) * 100));
	return `<article class="load-card">
		<div class="load-summary">
			<div>
				<strong>${escapeHtml(event.name)}</strong>
				<div class="muted">${new Date(event.startedAt).toLocaleTimeString()}</div>
			</div>
			<div>
				<code>${escapeHtml(event.file)}</code>
				<div class="bar"><span style="width:${width}%"></span></div>
			</div>
			<div>
				<strong>${event.duration} ms</strong>
				<div class="muted">${escapeHtml(event.environment)}</div>
			</div>
			<span class="badge ${event.status === 'error' ? 'warn' : 'hot'}">${escapeHtml(event.url || event.status)}</span>
		</div>
		${event.error ? `<pre class="json-view error-text">${escapeHtml(event.error)}</pre>` : ''}
	</article>`;
}

function renderLoadRow(event: LoadEvent, max: number) {
	const width = Math.max(4, Math.round((event.duration / max) * 100));
	return `<article class="load-card">
		<div class="load-summary">
			<div>
				<strong>${escapeHtml(event.route)}</strong>
				<div class="muted">${new Date(event.startedAt).toLocaleTimeString()}</div>
			</div>
			<div>
				<code>${escapeHtml(event.file)}</code>
				<div class="bar"><span style="width:${width}%"></span></div>
			</div>
			<div>
				<strong>${event.duration} ms</strong>
				<div class="muted">${escapeHtml(event.source)}</div>
			</div>
			<span class="badge ${event.status === 'error' ? 'warn' : 'hot'}">${
				event.status === 'error'
					? escapeHtml(event.error ?? 'error')
					: `${event.dataKeys.length || 0} keys`
			}</span>
		</div>
		<div class="detail-grid">
			${renderLoadContext(event)}
			${
				event.status === 'success'
					? `
					${renderJsonCard('Returned data', event.data)}
					${renderJsonCard('Parent data from event', event.eventData)}
				`
					: event.error
						? renderTextCard('Error', event.error)
						: ''
			}
		</div>
		${renderLoadFetches(event)}
	</article>`;
}

function renderLoadContext(event: LoadEvent) {
	return renderTextCard(
		'Route context',
		[
			`URL: ${event.url || event.route}`,
			`Params: ${formatJsonObject(event.params)}`,
			`Query: ${formatJsonObject(event.query)}`,
		].join('\n\n'),
	);
}

function formatJsonObject(value: Record<string, unknown> | undefined) {
	if (!value || Object.keys(value).length === 0) return 'none';
	return JSON.stringify(value, null, 2);
}

function renderLoadFetches(event: LoadEvent) {
	const fetches = event.fetches ?? [];
	if (fetches.length === 0) return '';

	return `<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Fetches inside load</h3>
				<p class="muted">Requests made through <code>event.fetch</code>.</p>
			</div>
			<span class="badge">${fetches.length} requests</span>
		</div>
		<div class="load-list">
			${fetches.map((fetch) => renderLoadFetch(fetch)).join('')}
		</div>
	</section>`;
}

function renderLoadFetch(fetch: LoadFetchEvent) {
	return `<article class="load-card">
		<div class="load-summary">
			<div>
				<strong>${escapeHtml(fetch.method)} ${escapeHtml(fetch.url)}</strong>
				<div class="muted">${new Date(fetch.startedAt).toLocaleTimeString()}</div>
			</div>
			<div>
				<code>${escapeHtml(fetch.statusText || 'fetch')}</code>
				<div class="bar"><span style="width:${Math.min(100, Math.max(4, fetch.duration))}%"></span></div>
			</div>
			<div>
				<strong>${fetch.duration} ms</strong>
				<div class="muted">fetch</div>
			</div>
			<span class="badge ${fetch.error || fetch.status >= 400 ? 'warn' : 'hot'}">${fetch.status || 'error'}</span>
		</div>
		${
			fetch.response || fetch.error
				? `<div class="detail-grid">
					${fetch.response ? renderJsonCard('Response', fetch.response) : ''}
					${fetch.error ? renderTextCard('Error', fetch.error) : ''}
				</div>`
				: ''
		}
	</article>`;
}

function renderRemotes() {
	remotesViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Remote functions</h2>
			<p class="muted">Exports from <code>.remote.js</code> and <code>.remote.ts</code> modules.</p>
		</div>
		<span class="badge">${state.remotes.length} functions</span>
	</div>
	<div class="detail-grid">
		${
			state.remotes.map((remote) => renderRemoteCard(remote)).join('') ||
			`<div class="empty">No remote functions found</div>`
		}
	</div>
	${renderRemoteCalls(state.remoteCalls)}`;
}

function renderRemoteCalls(calls: RemoteCallEvent[]) {
	return `<section class="remote-calls">
		<div class="section-head compact">
			<div>
				<h3>Recent remote calls</h3>
				<p class="muted">Calls captured from SvelteKit remote handlers.</p>
			</div>
			<span class="badge">${calls.length} calls</span>
		</div>
		<div class="load-list">
			${
				calls
					.map(
						(call) => `<article class="load-card">
							<div class="load-summary">
								<div>
									<strong>${escapeHtml(call.name)}</strong>
									<div class="muted">${new Date(call.startedAt).toLocaleTimeString()}</div>
								</div>
								<div>
									<code>${escapeHtml(call.importPath)}</code>
									<div class="bar"><span style="width:${Math.min(100, Math.max(4, call.duration))}%"></span></div>
								</div>
								<div>
									<strong>${call.duration} ms</strong>
									<div class="muted">runtime</div>
								</div>
								<span class="badge ${call.status === 'error' ? 'warn' : 'hot'}">${escapeHtml(call.status)}</span>
							</div>
							<div class="detail-grid">
								${renderTextCard('Input', call.input)}
								${renderTextCard(call.status === 'error' ? 'Error' : 'Output', call.error ?? call.output ?? 'undefined')}
							</div>
						</article>`,
					)
					.join('') || `<div class="empty">Run a remote function to collect calls</div>`
			}
		</div>
	</section>`;
}

function renderRemoteCard(remote: RemoteFunctionInfo) {
	const result = remoteResults[remote.id] ?? { status: 'idle' as const, text: 'No result yet' };
	const input = remoteInputs[remote.id] ?? '';
	const canRun = remote.callable && result.status !== 'running';
	return `<article class="result-card">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(remote.name)}</h3>
				<p class="muted">${escapeHtml(remote.file)}</p>
			</div>
			<span class="badge ${remote.kind === 'command' ? 'warn' : 'hot'}">${escapeHtml(remote.kind)}</span>
		</div>
		<button type="button" data-open-file="${escapeAttr(remote.file)}">Open file</button>
		<div class="meta-list">
			${renderMetaRow('Validator', remote.validator)}
			${renderMetaRow('Export', remote.name)}
		</div>
		<div class="tester">
			<label>
				<span class="muted">JSON input</span>
				<textarea data-remote="${escapeAttr(remote.id)}" placeholder='{"id":"42"}'>${escapeHtml(input)}</textarea>
			</label>
			<button type="button" data-run-remote="${escapeAttr(remote.id)}" ${canRun ? '' : 'disabled'}>${
				remote.callable
					? result.status === 'running'
						? 'Running'
						: 'Run'
					: 'Forms need a form element'
			}</button>
			${
				remote.kind === 'command'
					? `<p class="muted">Command can mutate server state. Click only when intended.</p>`
					: ''
			}
			<pre class="json-view ${result.status === 'error' ? 'error-text' : ''}">${escapeHtml(result.text)}</pre>
		</div>
	</article>`;
}

async function runRemote(remote: RemoteFunctionInfo) {
	let input: { hasValue: boolean; value: unknown };
	try {
		input = parseRemoteInput(remoteInputs[remote.id] ?? '');
	} catch (error) {
		remoteResults = {
			...remoteResults,
			[remote.id]: { status: 'error', text: errorMessage(error) },
		};
		renderRemotes();
		return;
	}

	remoteResults = { ...remoteResults, [remote.id]: { status: 'running', text: 'Running...' } };
	renderRemotes();

	try {
		const result = await runRemoteThroughBridge(remote, input);
		remoteResults = {
			...remoteResults,
			[remote.id]: { status: 'success', text: result },
		};
	} catch (error) {
		remoteResults = {
			...remoteResults,
			[remote.id]: { status: 'error', text: errorMessage(error) },
		};
	}

	await refresh(false);
}

function runRemoteThroughBridge(
	remote: RemoteFunctionInfo,
	input: { hasValue: boolean; value: unknown },
) {
	if (window.parent === window) {
		throw new Error('Remote tester runs from the Vite DevTools dock, not the direct fallback page');
	}

	const requestId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

	return new Promise<string>((resolve, reject) => {
		const timer = window.setTimeout(() => {
			window.removeEventListener('message', onMessage);
			reject(new Error('Remote call timed out'));
		}, 15000);

		function onMessage(event: MessageEvent) {
			if (event.origin !== location.origin) return;
			if (!event.data || event.data.type !== 'sveltekit-devtools:remote-result') return;
			if (event.data.requestId !== requestId) return;

			window.clearTimeout(timer);
			window.removeEventListener('message', onMessage);

			if (event.data.ok) resolve(event.data.text);
			else reject(new Error(event.data.text));
		}

		window.addEventListener('message', onMessage);
		window.parent.postMessage(
			{
				type: 'sveltekit-devtools:remote-call',
				requestId,
				remote: { importPath: remote.importPath, name: remote.name },
				input,
			},
			location.origin,
		);
	});
}

function parseRemoteInput(source: string) {
	const input = source.trim();
	if (!input) return { hasValue: false, value: undefined };
	return { hasValue: true, value: JSON.parse(input) as unknown };
}

function renderServerRoutes() {
	serverRoutesViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Server routes</h2>
			<p class="muted">SvelteKit <code>+server</code> endpoints with a same-origin request playground.</p>
		</div>
		<span class="badge">${state.serverRoutes.length} routes</span>
	</div>
	<div class="detail-grid">
		${
			state.serverRoutes.map((route) => renderServerRouteCard(route)).join('') ||
			`<div class="empty">No server routes found</div>`
		}
	</div>`;
}

function renderServerRouteCard(route: ServerRouteInfo) {
	const id = route.id;
	const method = serverRouteMethods[id] ?? route.methods[0] ?? 'GET';
	const path = serverRoutePaths[id] ?? defaultServerRoutePath(route);
	const headers = serverRouteHeaders[id] ?? '{}';
	const body = serverRouteBodies[id] ?? '';
	const result = serverRouteResults[id];

	return `<article class="result-card">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(route.path)}</h3>
				<p class="muted">${escapeHtml(route.file)}</p>
			</div>
			<span class="badge hot">${route.methods.length ? route.methods.join(', ') : 'no methods'}</span>
		</div>
		<button type="button" data-open-file="${escapeAttr(route.file)}">Open file</button>
		<div class="tester">
			<div class="request-row">
				<select data-server-route-method="${escapeAttr(id)}" aria-label="HTTP method">
					${serverRouteMethodOptions(route, method)}
				</select>
				<input data-server-route-path="${escapeAttr(id)}" value="${escapeAttr(path)}" aria-label="Request path" />
				<button type="button" data-run-server-route="${escapeAttr(id)}">Send</button>
			</div>
			<label>
				<span class="muted">Headers JSON</span>
				<textarea data-server-route-headers="${escapeAttr(id)}">${escapeHtml(headers)}</textarea>
			</label>
			<label>
				<span class="muted">Body</span>
				<textarea data-server-route-body="${escapeAttr(id)}">${escapeHtml(body)}</textarea>
			</label>
			${result ? renderServerRouteResult(result) : `<pre class="json-view">No response yet</pre>`}
		</div>
	</article>`;
}

function serverRouteMethodOptions(route: ServerRouteInfo, selected: HttpMethod) {
	const methods = route.methods.length ? route.methods : (['GET'] satisfies HttpMethod[]);
	return methods
		.map(
			(method) =>
				`<option value="${method}" ${method === selected ? 'selected' : ''}>${method}</option>`,
		)
		.join('');
}

function defaultServerRoutePath(route: ServerRouteInfo) {
	const values = Object.fromEntries(
		routePathParams(route.path).map((param) => [param.name, defaultRouteParamValue(param)]),
	);
	return fillRoutePath(route.path, values);
}

async function runServerRoute(route: ServerRouteInfo) {
	const id = route.id;
	const method = serverRouteMethods[id] ?? route.methods[0] ?? 'GET';
	const requestPath = (serverRoutePaths[id] ?? defaultServerRoutePath(route)).trim();
	const startedAt = Date.now();

	if (!requestPath.startsWith('/')) {
		serverRouteResults = {
			...serverRouteResults,
			[id]: {
				status: 0,
				statusText: 'Invalid path',
				duration: 0,
				headers: {},
				body: '',
				error: 'Request path must start with /',
			},
		};
		renderServerRoutes();
		return;
	}

	try {
		const headers = parseHeaders(serverRouteHeaders[id] ?? '{}');
		const body = serverRouteBodies[id] ?? '';
		const response = await fetch(requestPath, {
			method,
			headers,
			body: method === 'GET' || method === 'HEAD' || !body ? undefined : body,
		});
		const text = await response.text();
		serverRouteResults = {
			...serverRouteResults,
			[id]: {
				status: response.status,
				statusText: response.statusText,
				duration: Date.now() - startedAt,
				headers: Object.fromEntries(response.headers.entries()),
				body: text || '(empty)',
			},
		};
	} catch (error) {
		serverRouteResults = {
			...serverRouteResults,
			[id]: {
				status: 0,
				statusText: 'Request failed',
				duration: Date.now() - startedAt,
				headers: {},
				body: '',
				error: errorMessage(error),
			},
		};
	}

	renderServerRoutes();
}

function parseHeaders(source: string) {
	const value = source.trim();
	if (!value) return {};
	const parsed = JSON.parse(value) as Record<string, string>;
	return Object.fromEntries(
		Object.entries(parsed).map(([key, item]) => [
			key,
			typeof item === 'string' ? item : String(item),
		]),
	);
}

function renderServerRouteResult(result: ServerRouteResult) {
	const status = `${result.status || '-'} ${result.statusText}`;
	const value = result.error
		? result.error
		: JSON.stringify(
				{
					status,
					duration: `${result.duration} ms`,
					headers: result.headers,
					body: result.body,
				},
				null,
				2,
			);

	return `<pre class="json-view ${result.error ? 'error-text' : ''}">${escapeHtml(value)}</pre>`;
}

function renderActions() {
	actionsViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Actions</h2>
			<p class="muted">SvelteKit form actions from <code>+page.server</code> modules.</p>
		</div>
		<span class="badge">${state.routeActions.length} actions</span>
	</div>
	<div class="detail-grid">
		${
			state.routeActions.map((action) => renderActionCard(action)).join('') ||
			`<div class="empty">No form actions found</div>`
		}
	</div>`;
}

function renderActionCard(action: RouteActionInfo) {
	const input = actionInputs[action.id] ?? '{}';
	const result = actionResults[action.id];
	const path = actionRequestPath(action);

	return `<article class="result-card">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(action.name)}</h3>
				<p class="muted">${escapeHtml(action.file)}</p>
			</div>
			<span class="badge ${action.default ? 'hot' : ''}">${escapeHtml(action.path)}</span>
		</div>
		<button type="button" data-open-file="${escapeAttr(action.file)}">Open file</button>
		<div class="tester">
			<label>
				<span class="muted">Form fields JSON</span>
				<textarea data-action-input="${escapeAttr(action.id)}" placeholder='{"name":"Ada"}'>${escapeHtml(input)}</textarea>
			</label>
			<button type="button" data-run-action="${escapeAttr(action.id)}">Submit ${escapeHtml(path)}</button>
			${result ? renderActionResult(result) : `<pre class="json-view">No response yet</pre>`}
		</div>
	</article>`;
}

function actionRequestPath(action: RouteActionInfo) {
	const values = Object.fromEntries(
		routePathParams(action.path).map((param) => [param.name, defaultRouteParamValue(param)]),
	);
	const path = fillRoutePath(action.path, values);
	return action.default ? path : `${path}?/${encodeURIComponent(action.name)}`;
}

async function runAction(action: RouteActionInfo) {
	const id = action.id;
	const startedAt = Date.now();

	try {
		const response = await fetch(actionRequestPath(action), {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'x-sveltekit-action': 'true',
			},
			body: formDataFromJson(actionInputs[id] ?? '{}'),
		});
		actionResults = {
			...actionResults,
			[id]: {
				status: response.status,
				statusText: response.statusText,
				duration: Date.now() - startedAt,
				body: (await response.text()) || '(empty)',
			},
		};
	} catch (error) {
		actionResults = {
			...actionResults,
			[id]: {
				status: 0,
				statusText: 'Action failed',
				duration: Date.now() - startedAt,
				body: '',
				error: errorMessage(error),
			},
		};
	}

	renderActions();
}

function formDataFromJson(source: string) {
	const value = source.trim() ? (JSON.parse(source) as Record<string, unknown>) : {};
	const data = new FormData();
	for (const [key, item] of Object.entries(value)) {
		if (Array.isArray(item)) {
			for (const child of item) data.append(key, formValue(child));
		} else {
			data.append(key, formValue(item));
		}
	}
	return data;
}

function formValue(value: unknown) {
	if (value === null || value === undefined) return '';
	return typeof value === 'string' ? value : JSON.stringify(value);
}

function renderActionResult(result: ActionResult) {
	const value = result.error
		? result.error
		: JSON.stringify(
				{
					status: `${result.status || '-'} ${result.statusText}`,
					duration: `${result.duration} ms`,
					body: result.body,
				},
				null,
				2,
			);

	return `<pre class="json-view ${result.error ? 'error-text' : ''}">${escapeHtml(value)}</pre>`;
}

function renderAssets() {
	const total = state.assets.reduce((sum, asset) => sum + asset.size, 0);
	assetsViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Assets</h2>
			<p class="muted">Files served from SvelteKit <code>static</code>.</p>
		</div>
		<span class="badge">${state.assets.length} files · ${formatBytes(total)}</span>
	</div>
	<div class="detail-grid">
		${
			state.assets.map((asset) => renderAssetCard(asset)).join('') ||
			`<div class="empty">No static assets found</div>`
		}
	</div>`;
}

function renderAssetCard(asset: AssetInfo) {
	return `<article class="result-card">
		${renderAssetPreview(asset)}
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(asset.url)}</h3>
				<p class="muted">${escapeHtml(asset.path)}</p>
			</div>
			<span class="badge ${asset.preview === 'image' ? 'hot' : ''}">${escapeHtml(formatBytes(asset.size))}</span>
		</div>
		<div class="asset-actions">
			<button type="button" data-open-asset="${escapeAttr(asset.url)}">Open asset</button>
			<button type="button" data-open-file="${escapeAttr(asset.path)}">Open file</button>
		</div>
		<div class="meta-list">
			${renderMetaRow('Type', asset.type)}
			${renderMetaRow('Updated', new Date(asset.mtime).toLocaleString())}
		</div>
	</article>`;
}

function renderAssetPreview(asset: AssetInfo) {
	if (asset.preview === 'image') {
		return `<div class="asset-preview"><img src="${escapeAttr(asset.url)}" alt="" loading="lazy" /></div>`;
	}

	return `<div class="asset-preview muted">${escapeHtml(asset.preview)}</div>`;
}

function openAsset(url: string) {
	if (!url) return;
	window.open(url, '_blank', 'noopener,noreferrer');
}

function renderComponents() {
	const components = filterComponents(state.components, componentQuery);
	componentsViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Components</h2>
			<p class="muted">Svelte files in <code>src</code>, with props and local imports.</p>
		</div>
		<span class="badge">${components.length} / ${state.components.length} components</span>
	</div>
	<label class="search inline-search">
		<span>Search components</span>
		<input data-component-search type="search" autocomplete="off" placeholder="name, route, prop, file" value="${escapeAttr(componentQuery)}" />
	</label>
	${renderComponentGraph()}
	<div class="detail-grid">
		${
			components.map((component) => renderComponentCard(component)).join('') ||
			`<div class="empty">No components found</div>`
		}
	</div>`;
}

function renderComponentGraph() {
	const edges = componentGraphEdges(state.components);
	if (edges.length === 0) return '';

	return `<section class="route-components">
		<div class="section-head compact">
			<div>
				<h3>Component graph</h3>
				<p class="muted">Local component imports and route roots.</p>
			</div>
			<span class="badge">${edges.length} edges</span>
		</div>
		<div class="component-chain">
			${edges
				.map(
					(edge) => `<div class="component-chain-row">
						<div>
							<strong>${escapeHtml(edge.from.name)} -> ${escapeHtml(edge.to.name)}</strong>
							<p><code>${escapeHtml(edge.from.file)}</code> imports <code>${escapeHtml(edge.to.file)}</code></p>
						</div>
						<span class="badge ${edge.from.kind === 'route' ? 'hot' : ''}">${escapeHtml(edge.from.kind)}</span>
						<button type="button" data-open-file="${escapeAttr(edge.to.file)}">Open target</button>
					</div>`,
				)
				.join('')}
		</div>
	</section>`;
}

function renderVirtualFiles() {
	const total = state.virtualFiles.reduce((sum, file) => sum + file.size, 0);
	virtualFilesViewEl.innerHTML = `<div class="section-head">
		<div>
			<h2>Virtual files</h2>
			<p class="muted">Generated files from <code>.svelte-kit/generated</code>.</p>
		</div>
		<span class="badge">${state.virtualFiles.length} files · ${formatBytes(total)}</span>
	</div>
	<div class="virtual-file-list">
		${
			state.virtualFiles.map((file) => renderVirtualFileCard(file)).join('') ||
			`<div class="empty">Run SvelteKit once to generate files</div>`
		}
	</div>`;
}

function renderVirtualFileCard(file: VirtualFileInfo) {
	return `<article class="load-card">
		<div class="load-summary virtual-file-summary">
			<div>
				<strong>${escapeHtml(file.path)}</strong>
				<div class="muted">${new Date(file.mtime).toLocaleString()}</div>
			</div>
			<div>
				<code>${escapeHtml(file.kind)}</code>
				<div class="bar"><span style="width:${Math.min(100, Math.max(4, file.size / 400))}%"></span></div>
			</div>
			<div>
				<strong>${escapeHtml(formatBytes(file.size))}</strong>
				<div class="muted">${file.truncated ? 'preview' : 'full'}</div>
			</div>
			<button type="button" data-open-file="${escapeAttr(file.path)}">Open file</button>
		</div>
		<pre class="json-view">${escapeHtml(file.text)}${file.truncated ? '\n... truncated' : ''}</pre>
	</article>`;
}

function renderComponentCard(component: ComponentInfo) {
	return `<article class="result-card">
		<div class="section-head compact">
			<div>
				<h3>${escapeHtml(component.name)}</h3>
				<p class="muted">${escapeHtml(component.file)}</p>
			</div>
			<span class="badge ${component.kind === 'route' ? 'hot' : ''}">${escapeHtml(component.kind)}</span>
		</div>
		<button type="button" data-open-file="${escapeAttr(component.file)}">Open file</button>
		<div class="meta-list">
			${renderMetaRow('Route', component.route ?? '—')}
			${renderMetaRow('Props', component.props.join(', ') || 'none')}
			${renderMetaRow('Imports', component.imports.join(', ') || 'none')}
			${renderMetaRow('Used by', component.usedBy.join(', ') || 'none')}
			${renderMetaRow(
				'Blocks',
				[
					component.hasModuleScript ? 'module script' : '',
					component.hasInstanceScript ? 'instance script' : '',
					component.hasStyle ? 'style' : '',
				]
					.filter(Boolean)
					.join(', ') || 'markup only',
			)}
		</div>
	</article>`;
}

function latestLoad(route: SvelteKitRoute) {
	return routeLoadEvents(state.loads, route)[0];
}

function loadFetchCount() {
	return state.loads.reduce((count, event) => count + (event.fetches?.length ?? 0), 0);
}

function routeParamValues(route: SvelteKitRoute) {
	routeParamInputs[route.id] ??= Object.fromEntries(
		routePathParams(route.path).map((param) => [param.name, defaultRouteParamValue(param)]),
	);
	return routeParamInputs[route.id];
}

async function openSourceFile(file: string) {
	if (!file) return;

	const rpc = await rpcClient();
	if (!rpc) {
		setStatus('Open file needs dock', 'error');
		return;
	}

	await rpc.call('vite:core:open-in-editor', file.startsWith('/') ? file : `${state.root}/${file}`);
	setStatus('Opened file', 'live');
}

function openRoute(path: string) {
	const next = path.trim();
	if (!next.startsWith('/')) {
		setStatus('Route must start with /', 'error');
		return;
	}

	if (window.parent === window) {
		location.assign(next);
		return;
	}

	window.parent.postMessage({ type: 'sveltekit-devtools:navigate', path: next }, location.origin);
}

function renderJsonCard(title: string, value: SerializedValue | undefined) {
	return `<div class="result-card">
		<h3>${escapeHtml(title)}</h3>
		<pre class="json-view">${escapeHtml(value?.text ?? 'undefined')}${value?.truncated ? '\n… truncated' : ''}</pre>
	</div>`;
}

function renderTextCard(title: string, value: string) {
	return `<div class="result-card">
		<h3>${escapeHtml(title)}</h3>
		<pre class="json-view">${escapeHtml(value)}</pre>
	</div>`;
}

function renderMetaRow(label: string, value: string) {
	return `<div class="meta-row">
		<span>${escapeHtml(label)}</span>
		<strong>${escapeHtml(value)}</strong>
	</div>`;
}

function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function setStatus(value: string, className: string) {
	statusEl.textContent = value;
	statusEl.className = `status ${className}`;
}

function pauseAutoRefresh() {
	pauseAutoRefreshUntil = Date.now() + 5000;
}

function text(selector: string, value: string) {
	element(selector).textContent = value;
}

function element<T extends Element = HTMLElement>(selector: string): T {
	const match = document.querySelector<T>(selector);
	if (!match) throw new Error(`Missing ${selector}`);
	return match;
}

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char);
}

function escapeAttr(value: string) {
	return escapeHtml(value);
}

const htmlEscapes: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};
