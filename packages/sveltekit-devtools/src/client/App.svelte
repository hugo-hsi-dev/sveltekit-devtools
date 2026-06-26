<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Fuse from 'fuse.js';

	import type { ActionResult, ServerRouteResult } from './shared/view-context';
	import type {
		AssetInfo,
		BuildAnalysis,
		ComponentInfo,
		DevtoolsState,
		HttpMethod,
		ImportInfo,
		LoadEvent,
		LoadFetchEvent,
		ModuleGraphInfo,
		ModuleGraphModuleInfo,
		RemoteFunctionInfo,
		RouteActionInfo,
		RuntimeEnvVar,
		SeoMeta,
		SerializedValue,
		ServerRouteInfo,
		SvelteKitRoute,
		TaskRunEvent,
		TaskScriptInfo,
		VirtualFileInfo,
		VitePluginInfo,
	} from '../shared/types';
	import { assetExtensions, filterAssets } from './asset-filters';
	import Badge from './components/Badge.svelte';
	import ActionCard from './components/ActionCard.svelte';
	import AssetPreview from './components/AssetPreview.svelte';
	import ComponentCard from './components/ComponentCard.svelte';
	import ComponentGraph from './components/ComponentGraph.svelte';
	import FileCard from './components/FileCard.svelte';
	import ImportCard from './components/ImportCard.svelte';
	import LoadList from './components/LoadList.svelte';
	import LoadRows from './components/LoadRows.svelte';
	import Loading from './components/Loading.svelte';
	import MetaRow from './components/MetaRow.svelte';
	import ModuleCard from './components/ModuleCard.svelte';
	import Navbar from './components/Navbar.svelte';
	import Panel from './components/Panel.svelte';
	import PluginCard from './components/PluginCard.svelte';
	import RemoteCard from './components/RemoteCard.svelte';
	import RuntimeEnvRow from './components/RuntimeEnvRow.svelte';
	import ServerRouteCard from './components/ServerRouteCard.svelte';
	import SimplePluginView from './components/SimplePluginView.svelte';
	import TaskCard from './components/TaskCard.svelte';
	import TaskRunCard from './components/TaskRunCard.svelte';
	import TextCard from './components/TextCard.svelte';
	import VirtualFileCard from './components/VirtualFileCard.svelte';
	import { filterImports, importKindCounts, type ImportFilterKind } from './import-filters';
	import {
		matchedRoutes,
		matchRoutePath,
		normalizeRouteInput,
		routeMatchesPath,
	} from './route-match';
	import { componentGraphEdges, routeComponentUsages } from './route-components';
	import { routeLoadEvents } from './route-loads';
	import {
		defaultRouteParamValue,
		fillRoutePath,
		routePathParams,
		type RoutePathParam,
	} from './route-params';
	import {
		bestSeoDescription,
		bestSeoImage,
		bestSeoTitle,
		missingSeoItems,
		normalizeSeoTags,
	} from './seo';
	import {
		defaultDevtoolsSettings,
		isCategoryVisible,
		isViewVisible,
		normalizeSettings,
		setHiddenCategory,
		setHiddenView,
		setPinnedView,
		type DevtoolsSettings,
	} from './settings';
	import { timelineEvents, type TimelineEvent } from './timeline';
	import { icons, svelteLogo } from './shared/icons';
	import {
		allViews,
		configurableCategories,
		configurableViews,
		navCategories,
		viewIcons,
		viewLabels,
		viewToCategory,
		type View,
	} from './shared/view-context';

	type RemoteRunState = 'idle' | 'running' | 'success' | 'error';
	type CommandItem = {
		id: string;
		label: string;
		group: string;
	};

	const settingsKey = 'sveltekit-devtools:settings';
	const apiBase = new URL('./api/', location.href).pathname;
	const importTabs: Array<{ value: ImportFilterKind; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'sveltekit', label: 'SvelteKit' },
		{ value: 'lib', label: '$lib' },
		{ value: 'package', label: 'Package' },
		{ value: 'relative', label: 'Relative' },
		{ value: 'asset', label: 'Asset' },
	];

	let state: DevtoolsState = emptyState();
	let view: View = 'overview';
	let status = { text: 'Connecting', tone: '' };
	let loading = true;
	let rpcPromise: Promise<any | null> | undefined;
	let settings = loadSettings();
	let hostTheme: 'dark' | 'light' | null = null;
	let currentRoute = '';
	let pauseAutoRefreshUntil = 0;

	let selectedRoute = '';
	let routeQuery = '';
	let routeInput = '/';
	let routeParamInputs: Record<string, Record<string, string>> = {};

	let importQuery = '';
	let importKind: ImportFilterKind = 'all';
	let assetQuery = '';
	let assetExtension = 'all';
	let selectedAssetId = '';
	let componentQuery = '';
	let selectedComponentFile = '';

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

	let timelineKind = 'all';
	let timelineRecording = true;
	let timelineSnapshot: TimelineEvent[] | null = null;

	let seoRouteInput = '/';
	let seoMeta: SeoMeta | null = null;
	let seoStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	let seoError = '';

	let paletteOpen = false;
	let paletteQuery = '';
	let paletteIndex = 0;
	let paletteInput: HTMLInputElement;

	$: routeList = searchItems(state.routes, routeQuery, ['path', 'id']);
	$: selectedRouteData =
		state.routes.find((route) => route.id === selectedRoute) ?? state.routes[0] ?? null;
	$: routeMatches = matchedRoutes(state.routes, routeInput || currentRoute || '/');
	$: importCounts = importKindCounts(state.imports);
	$: importsByFilter = filterImports(state.imports, { kind: importKind });
	$: visibleImports = searchItems(importsByFilter, importQuery, [
		'specifier',
		'kind',
		'importedBy',
	]);
	$: assetExtensionOptions = assetExtensions(state.assets);
	$: visibleAssets = searchItems(
		filterAssets(state.assets, { extension: assetExtension }),
		assetQuery,
		['path', 'url', 'type', 'preview'],
	);
	$: selectedAsset = state.assets.find((asset) => asset.id === selectedAssetId) ?? null;
	$: visibleComponents = searchItems(state.components, componentQuery, [
		'name',
		'file',
		'kind',
		'route',
		'props',
	]);
	$: selectedComponent =
		state.components.find((component) => component.file === selectedComponentFile) ??
		visibleComponents[0] ??
		null;
	$: timelineSource = timelineRecording ? timelineEvents(state) : (timelineSnapshot ?? []);
	$: timelineKinds = [...new Set(timelineSource.map((event) => event.kind))];
	$: timelineRows =
		timelineKind === 'all'
			? timelineSource
			: timelineSource.filter((event) => event.kind === timelineKind);
	$: timelineMax = Math.max(1, ...timelineRows.map((event) => event.duration));
	$: hookMax = Math.max(1, ...state.hookEvents.map((event) => event.duration));
	$: analysis = state.buildAnalysis;
	$: graph = state.moduleGraph;
	$: commandItems = buildCommandItems();
	$: paletteResults = searchItems(commandItems, paletteQuery, ['label', 'group']).slice(0, 40);
	$: if (paletteIndex >= paletteResults.length) paletteIndex = 0;
	$: applySettings();
	$: if (paletteOpen) void focusPalette();

	onMount(() => {
		const initialHash = location.hash.slice(1) as View;
		if (allViews.includes(initialHash) && canUseView(initialHash)) view = initialHash;
		else if (location.hash) history.replaceState(null, '', `#${view}`);
		const onHashChange = () => {
			const next = location.hash.slice(1) as View;
			if (allViews.includes(next) && canUseView(next)) view = next;
		};
		window.addEventListener('hashchange', onHashChange);

		const media = window.matchMedia?.('(prefers-color-scheme: light)');
		const onSchemeChange = () => {
			if (settings.theme === 'auto') applySettings();
		};
		media?.addEventListener?.('change', onSchemeChange);

		let sseTimer: ReturnType<typeof setTimeout> | undefined;
		let events: EventSource | undefined;
		try {
			events = new EventSource(api('events'));
			events.onmessage = () => {
				if (document.hidden || Date.now() <= pauseAutoRefreshUntil) return;
				clearTimeout(sseTimer);
				sseTimer = setTimeout(() => void refresh(false), 120);
			};
		} catch {
			// Poll below covers browsers or hosts without EventSource.
		}

		const poll = setInterval(() => {
			if (!document.hidden && Date.now() > pauseAutoRefreshUntil) void refresh(false);
		}, 4000);

		void refresh();

		return () => {
			clearInterval(poll);
			clearTimeout(sseTimer);
			events?.close();
			window.removeEventListener('hashchange', onHashChange);
			media?.removeEventListener?.('change', onSchemeChange);
		};
	});

	async function refresh(showLoading = true) {
		if (showLoading) {
			loading = true;
			setStatus('Loading', '');
		}
		try {
			state = await readState();
			selectedRoute ||= state.routes[0]?.id ?? '';
			if (!routeInput || routeInput === '/')
				routeInput = currentRoute || state.routes[0]?.path || '/';
			if (!seoRouteInput || seoRouteInput === '/') seoRouteInput = currentRoute || '/';
			setStatus('Live', 'live');
		} catch (error) {
			setStatus(errorMessage(error), 'error');
		} finally {
			loading = false;
		}
	}

	async function readState(): Promise<DevtoolsState> {
		const rpc = await rpcClient();
		if (rpc) return rpc.call('sveltekit-devtools:get-state');

		const response = await fetch(api('state'));
		if (!response.ok) throw new Error('Devtools API failed');
		return response.json();
	}

	async function clearLoads() {
		const rpc = await rpcClient();
		if (rpc) await rpc.call('sveltekit-devtools:clear-loads');
		else await fetch(api('clear'), { method: 'POST' });
		await refresh(false);
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

	function setView(next: View) {
		if (!canUseView(next)) return;
		view = next;
		history.replaceState(null, '', `#${next}`);
		if (view === 'open-graph') void requestSeoMeta();
	}

	function canUseView(item: View) {
		if (item === 'overview' || item === 'settings') return true;
		const category = viewToCategory[item];
		const pinned = settings.pinnedViews.includes(item);
		return (
			isViewVisible(settings, item) &&
			(!category || pinned || isCategoryVisible(settings, category))
		);
	}

	function categoryViews(category: (typeof navCategories)[number]) {
		return category.views.filter((item) => isViewVisible(settings, item));
	}

	function buildCommandItems(): CommandItem[] {
		return [
			...allViews
				.filter((item) => canUseView(item))
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
		paletteOpen = false;
		if (id.startsWith('view:')) {
			setView(id.slice('view:'.length) as View);
			return;
		}
		if (id.startsWith('route:')) {
			const route = state.routes.find((item) => item.id === id.slice('route:'.length));
			if (route) selectRoute(route);
			return;
		}
		if (id === 'action:refresh') await refresh();
		if (id === 'action:clear-loads') await clearLoads();
		if (id === 'action:build-analyze') {
			setView('build-analyze');
			await runBuildAnalyze();
		}
		if (id === 'action:open-graph') {
			setView('open-graph');
			await requestSeoMeta();
		}
	}

	function selectRoute(route: SvelteKitRoute) {
		selectedRoute = route.id;
		routeInput = routeOpenPath(route);
		setView('routes');
	}

	function routeOpenPath(route: SvelteKitRoute) {
		return fillRoutePath(route.path, routeParamValues(route));
	}

	function routeParamValues(route: SvelteKitRoute) {
		routeParamInputs[route.id] ??= Object.fromEntries(
			routePathParams(route.path).map((param) => [param.name, defaultRouteParamValue(param)]),
		);
		return routeParamInputs[route.id];
	}

	function setRouteParam(route: SvelteKitRoute, param: RoutePathParam, value: string) {
		routeParamInputs = {
			...routeParamInputs,
			[route.id]: { ...routeParamValues(route), [param.name]: value },
		};
		routeInput = routeOpenPath(route);
		pauseAutoRefresh();
	}

	function openRoute(path: string, refreshSeo = false) {
		const next = normalizeRouteInput(path);
		if (!next.startsWith('/')) {
			setStatus('Route must start with /', 'error');
			return;
		}
		if (window.parent === window) {
			location.assign(next);
			return;
		}
		window.parent.postMessage({ type: 'sveltekit-devtools:navigate', path: next }, location.origin);
		if (refreshSeo) setTimeout(() => void requestSeoMeta(), 700);
	}

	async function requestSeoMeta() {
		seoStatus = 'loading';
		try {
			seoMeta =
				window.parent === window
					? readSeoMetaFromDocument(document)
					: await readSeoMetaFromParent();
			seoStatus = 'ready';
			seoError = '';
		} catch (error) {
			seoStatus = 'error';
			seoError = errorMessage(error);
		}
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
				resolve(normalizeIncomingSeoMeta(event.data.meta as SeoMeta));
			}

			window.addEventListener('message', onMessage);
			window.parent.postMessage(
				{ type: 'sveltekit-devtools:seo-meta', requestId },
				location.origin,
			);
		});
	}

	function readSeoMetaFromDocument(doc: Document): SeoMeta {
		return normalizeIncomingSeoMeta({
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
			tags: readSeoTags(doc),
		});
	}

	function normalizeIncomingSeoMeta(meta: SeoMeta): SeoMeta {
		return { ...meta, tags: normalizeSeoTags({ ...meta, tags: meta.tags ?? [] }) };
	}

	function readMeta(doc: Document, attribute: 'name' | 'property', value: string) {
		return doc.querySelector(`meta[${attribute}="${value}"]`)?.getAttribute('content') ?? '';
	}

	function readSeoTags(doc: Document) {
		const tags = [];
		if (doc.title) tags.push({ tag: 'title', name: '<title>', value: doc.title });
		for (const item of doc.querySelectorAll('meta[name], meta[property]')) {
			tags.push({
				tag: 'meta',
				name: item.getAttribute('name') || item.getAttribute('property') || '',
				value: item.getAttribute('content') || '',
			});
		}
		for (const item of doc.querySelectorAll('link[rel]')) {
			tags.push({
				tag: 'link',
				name: item.getAttribute('rel') || '',
				value: item.getAttribute('href') || '',
			});
		}
		return tags;
	}

	async function runBuildAnalyze() {
		state = {
			...state,
			buildAnalysis: { status: 'running', startedAt: Date.now(), totalSize: 0, assets: [] },
		};
		const response = await fetch(api('build-analyze'), { method: 'POST' });
		if (!response.ok) throw new Error('Build analyze failed');
		state = { ...state, buildAnalysis: (await response.json()) as BuildAnalysis };
	}

	async function runTask(task: TaskScriptInfo) {
		runningTasks = { ...runningTasks, [task.name]: true };
		try {
			const response = await fetch(api('tasks/run'), {
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
			return;
		}
		remoteResults = { ...remoteResults, [remote.id]: { status: 'running', text: 'Running...' } };
		try {
			const text = await runRemoteThroughBridge(remote, input);
			remoteResults = { ...remoteResults, [remote.id]: { status: 'success', text } };
			await refresh(false);
		} catch (error) {
			remoteResults = {
				...remoteResults,
				[remote.id]: { status: 'error', text: errorMessage(error) },
			};
		}
	}

	function runRemoteThroughBridge(
		remote: RemoteFunctionInfo,
		input: { hasValue: boolean; value: unknown },
	) {
		if (window.parent === window) {
			throw new Error(
				'Remote tester runs from the Vite DevTools dock, not the direct fallback page',
			);
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
			serverRouteResults = {
				...serverRouteResults,
				[id]: {
					status: response.status,
					statusText: response.statusText,
					duration: Date.now() - startedAt,
					headers: Object.fromEntries(response.headers.entries()),
					body: (await response.text()) || '(empty)',
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
	}

	function parseHeaders(source: string) {
		const value = source.trim();
		if (!value) return {};
		const parsed = JSON.parse(value) as Record<string, string>;
		return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]));
	}

	async function runAction(action: RouteActionInfo) {
		const startedAt = Date.now();
		try {
			const response = await fetch(actionRequestPath(action), {
				method: 'POST',
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
				body: formDataFromJson(actionInputs[action.id] ?? '{}'),
			});
			actionResults = {
				...actionResults,
				[action.id]: {
					status: response.status,
					statusText: response.statusText,
					duration: Date.now() - startedAt,
					body: (await response.text()) || '(empty)',
				},
			};
		} catch (error) {
			actionResults = {
				...actionResults,
				[action.id]: {
					status: 0,
					statusText: 'Action failed',
					duration: Date.now() - startedAt,
					body: '',
					error: errorMessage(error),
				},
			};
		}
	}

	function formDataFromJson(source: string) {
		const value = source.trim() ? (JSON.parse(source) as Record<string, unknown>) : {};
		const data = new FormData();
		for (const [key, item] of Object.entries(value)) {
			if (Array.isArray(item)) for (const child of item) data.append(key, formValue(child));
			else data.append(key, formValue(item));
		}
		return data;
	}

	function formValue(value: unknown) {
		if (value === null || value === undefined) return '';
		return typeof value === 'string' ? value : JSON.stringify(value);
	}

	function actionRequestPath(action: RouteActionInfo) {
		const values = Object.fromEntries(
			routePathParams(action.path).map((param) => [param.name, defaultRouteParamValue(param)]),
		);
		const path = fillRoutePath(action.path, values);
		return action.default ? path : `${path}?/${encodeURIComponent(action.name)}`;
	}

	function defaultServerRoutePath(route: ServerRouteInfo) {
		const values = Object.fromEntries(
			routePathParams(route.path).map((param) => [param.name, defaultRouteParamValue(param)]),
		);
		return fillRoutePath(route.path, values);
	}

	async function openSourceFile(file: string, line?: number, column?: number) {
		if (!file) return;
		const target = file.startsWith('/') ? file : `${state.root}/${file}`;
		const positioned = line ? `${target}:${line}${column ? `:${column}` : ''}` : target;
		const rpc = await rpcClient();
		if (rpc) {
			await rpc.call('vite:core:open-in-editor', positioned);
			setStatus('Opened file', 'live');
			return;
		}
		try {
			const response = await fetch(api('open-in-editor'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ file: target, line, column, editor: settings.editor || undefined }),
			});
			if (!response.ok) throw new Error('Open in editor failed');
			setStatus('Opened file', 'live');
		} catch {
			setStatus('Open file failed', 'error');
		}
	}

	function updateSettings(value: Partial<DevtoolsSettings>) {
		settings = normalizeSettings(
			{ ...settings, ...value },
			configurableViews,
			configurableCategories,
		);
		saveSettings();
		if (!canUseView(view)) setView('overview');
	}

	function toggleHiddenView(item: string, hidden: boolean) {
		settings = setHiddenView(settings, item, hidden, configurableViews);
		saveSettings();
		if (view === item && hidden) setView('overview');
	}

	function toggleHiddenCategory(category: string, hidden: boolean) {
		settings = setHiddenCategory(
			settings,
			category,
			hidden,
			configurableViews,
			configurableCategories,
		);
		saveSettings();
		if (!canUseView(view)) setView('overview');
	}

	function togglePinnedView(item: string, pinned: boolean) {
		settings = setPinnedView(settings, item, pinned, configurableViews, configurableCategories);
		saveSettings();
	}

	function loadSettings() {
		try {
			return normalizeSettings(
				JSON.parse(localStorage.getItem(settingsKey) ?? 'null') as Partial<DevtoolsSettings> | null,
				configurableViews,
				configurableCategories,
			);
		} catch {
			return normalizeSettings(null, configurableViews, configurableCategories);
		}
	}

	function saveSettings() {
		localStorage.setItem(settingsKey, JSON.stringify(settings));
		applySettings();
	}

	function applySettings() {
		document.documentElement.style.setProperty('--devtools-font-size', `${settings.scale}%`);
		document.body.dataset.density = settings.compact ? 'compact' : 'comfortable';
		document.documentElement.dataset.theme = resolvedTheme();
	}

	function resolvedTheme(): 'dark' | 'light' {
		if (settings.theme === 'dark' || settings.theme === 'light') return settings.theme;
		if (hostTheme) return hostTheme;
		return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
	}

	function handleHostMessage(event: MessageEvent) {
		if (event.origin !== location.origin) return;
		const data = event.data as { type?: string; scheme?: string; route?: string } | null;
		if (data?.type !== 'sveltekit-devtools:host') return;
		if ((data.scheme === 'dark' || data.scheme === 'light') && hostTheme !== data.scheme) {
			hostTheme = data.scheme;
			applySettings();
		}
		if (typeof data.route === 'string' && data.route !== currentRoute) {
			currentRoute = data.route;
			if (!routeInput || routeInput === '/') routeInput = data.route;
			if (!seoRouteInput || seoRouteInput === '/') seoRouteInput = data.route;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = !paletteOpen;
			paletteQuery = '';
			paletteIndex = 0;
			return;
		}
		if (!paletteOpen) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			paletteOpen = false;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			paletteIndex = Math.min(paletteResults.length - 1, paletteIndex + 1);
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			paletteIndex = Math.max(0, paletteIndex - 1);
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			void runCommand(paletteResults[paletteIndex]?.id ?? '');
		}
	}

	function closePaletteFromBackdrop(event: MouseEvent | KeyboardEvent) {
		if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
		if (event instanceof MouseEvent && event.target !== event.currentTarget) return;
		event.preventDefault();
		paletteOpen = false;
	}

	async function focusPalette() {
		await tick();
		paletteInput?.focus();
	}

	function searchItems<T>(items: T[], query: string, keys: string[]) {
		const value = query.trim();
		if (!value) return items;
		return new Fuse(items, { keys, threshold: 0.35, ignoreLocation: true })
			.search(value)
			.map((hit) => hit.item);
	}

	function routeIsCurrent(route: SvelteKitRoute) {
		return currentRoute ? routeMatchesPath(route.path, currentRoute) : false;
	}

	function latestLoad(route: SvelteKitRoute) {
		return routeLoadEvents(state.loads, route)[0];
	}

	function loadFetchCount() {
		return state.loads.reduce((count, event) => count + (event.fetches?.length ?? 0), 0);
	}

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	function json(value: unknown) {
		return JSON.stringify(value, null, 2);
	}

	function serializedText(value: SerializedValue | undefined) {
		return `${value?.text ?? 'undefined'}${value?.truncated ? '\n... truncated' : ''}`;
	}

	function formatJsonObject(value: Record<string, unknown> | undefined) {
		if (!value || Object.keys(value).length === 0) return 'none';
		return JSON.stringify(value, null, 2);
	}

	function moduleKindCount(graph: ModuleGraphInfo, kind: ModuleGraphModuleInfo['kind']) {
		return graph.modules.filter((module) => module.kind === kind).length;
	}

	function resultText(result: ServerRouteResult | ActionResult) {
		if (result.error) return result.error;
		return json({
			status: `${result.status || '-'} ${result.statusText}`,
			duration: `${result.duration} ms`,
			...('headers' in result ? { headers: result.headers } : {}),
			body: result.body,
		});
	}

	function openAsset(asset: AssetInfo) {
		window.open(asset.url, '_blank', 'noopener,noreferrer');
	}

	function pauseAutoRefresh() {
		pauseAutoRefreshUntil = Date.now() + 5000;
	}

	function setStatus(text: string, tone: string) {
		status = { text, tone };
	}

	function errorMessage(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}

	function api(path: string) {
		return `${apiBase}${path}`;
	}

	function emptyState(): DevtoolsState {
		return {
			root: '',
			project: { name: '', version: '', packageManager: '', dependencies: [], vitePlugins: [] },
			runtimeConfig: { mode: '', base: '', envPrefix: [], env: [] },
			buildAnalysis: { status: 'idle', startedAt: 0, totalSize: 0, assets: [] },
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
	}
</script>

<svelte:window on:message={handleHostMessage} on:keydown={handleKeydown} />

<div
	class="devtools-shell"
	class:sidebar-collapsed={!settings.sidebarExpanded}
	class:sidebar-fixed={!settings.sidebarScrollable}
>
	<Navbar>
		<div class="rail-logo" aria-label="SvelteKit Devtools">{@html svelteLogo}</div>
		<button
			class="sidebar-row"
			class:active={view === 'overview'}
			type="button"
			title="Overview"
			on:click={() => setView('overview')}
		>
			<span class="sidebar-icon">{@html icons.overview}</span>
			<span class="sidebar-label">Overview</span>
		</button>

		{#if settings.pinnedViews.length}
			<div class="sidebar-category">
				<span>Pinned</span>
				{#each settings.pinnedViews.filter((item) => isViewVisible(settings, item)) as item}
					<button
						class="sidebar-row"
						class:active={view === item}
						type="button"
						title={viewLabels[item]}
						on:click={() => setView(item)}
					>
						<span class="sidebar-icon">{@html icons[viewIcons[item]]}</span>
						<span class="sidebar-label">{viewLabels[item]}</span>
					</button>
				{/each}
			</div>
		{/if}

		{#each navCategories as category}
			{#if isCategoryVisible(settings, category.id)}
				<div class="sidebar-category">
					<span>{category.label}</span>
					{#each categoryViews(category) as item}
						<button
							class="sidebar-row"
							class:active={view === item}
							type="button"
							title={viewLabels[item]}
							on:click={() => setView(item)}
						>
							<span class="sidebar-icon">{@html icons[viewIcons[item]]}</span>
							<span class="sidebar-label">{viewLabels[item]}</span>
						</button>
					{/each}
				</div>
			{/if}
		{/each}

		<div class="rail-spacer"></div>
		<button
			class="sidebar-row"
			type="button"
			title={settings.sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
			on:click={() => updateSettings({ sidebarExpanded: !settings.sidebarExpanded })}
		>
			<span class="sidebar-icon">⇤</span>
			<span class="sidebar-label">Collapse</span>
		</button>
		<button
			class="sidebar-row"
			class:active={view === 'settings'}
			type="button"
			title="Settings"
			on:click={() => setView('settings')}
		>
			<span class="sidebar-icon">{@html icons.settings}</span>
			<span class="sidebar-label">Settings</span>
		</button>
	</Navbar>

	<main class="content n-panel-grids">
		<header class="content-header">
			<div class="view-title">
				<span>{@html icons[viewIcons[view]]}</span>
				<div>
					<h1>{viewLabels[view]}</h1>
					<p class="muted">{state.project.name || state.root || 'SvelteKit app'}</p>
				</div>
			</div>
			<div class="actions">
				<span class="status {status.tone}">{status.text}</span>
				<button type="button" on:click={() => (paletteOpen = true)}>Commands</button>
				<button class="icon-button" type="button" title="Refresh" on:click={() => refresh()}
					>↻</button
				>
				{#if view === 'loads'}
					<button type="button" on:click={clearLoads}>Clear loads</button>
				{/if}
			</div>
		</header>

		{#if loading && !state.generatedAt}
			<div class="view"><Loading>Loading devtools state</Loading></div>
		{:else}
			{#key view}
				<section class="view" in:fly={{ y: 6, duration: 160 }} out:fade={{ duration: 80 }}>
					{#if view === 'overview'}
						<div class="section-head">
							<div>
								<h2>{state.project.name || 'Project'}</h2>
								<p class="muted">{state.root}</p>
							</div>
							<Badge>{state.project.version || 'dev'}</Badge>
						</div>
						<div class="detail-grid">
							<article class="result-card">
								<h3>Project</h3>
								<div class="meta-list">
									<MetaRow
										label="Package manager"
										value={state.project.packageManager || 'unknown'}
									/>
									<MetaRow label="Routes" value={String(state.routes.length)} />
									<MetaRow label="Load fetches" value={String(loadFetchCount())} />
									<MetaRow label="Hooks" value={String(state.hooks.length)} />
									<MetaRow label="Components" value={String(state.components.length)} />
									<MetaRow label="Imports" value={String(state.imports.length)} />
									<MetaRow label="Assets" value={String(state.assets.length)} />
									<MetaRow label="Server routes" value={String(state.serverRoutes.length)} />
									<MetaRow label="Actions" value={String(state.routeActions.length)} />
									<MetaRow label="Remotes" value={String(state.remotes.length)} />
									<MetaRow label="Virtual files" value={String(state.virtualFiles.length)} />
									<MetaRow label="Build size" value={formatBytes(state.buildAnalysis.totalSize)} />
								</div>
							</article>
							<article class="result-card">
								<h3>Core packages</h3>
								<div class="meta-list">
									{#each state.project.dependencies.filter( (dep) => ['@sveltejs/kit', 'svelte', 'vite', 'sveltekit-devtools'].includes(dep.name), ) as dep}
										<MetaRow label={dep.name} value={`${dep.version} · ${dep.type}`} />
									{:else}
										<div class="empty small">No SvelteKit packages found</div>
									{/each}
								</div>
							</article>
						</div>
						<Panel title="Vite plugins" detail="Plugins active in this dev server">
							<svelte:fragment slot="meta"
								><Badge>{state.project.vitePlugins.length} plugins</Badge></svelte:fragment
							>
							<div class="detail-grid">
								{#each state.project.vitePlugins.slice(0, 24) as plugin}
									<PluginCard {plugin} />
								{:else}
									<div class="empty">No Vite plugins found</div>
								{/each}
							</div>
						</Panel>
					{:else if view === 'routes'}
						<div class="routes-layout">
							<aside class="routes-sidebar">
								<label class="search">
									<span>Search routes</span>
									<input
										bind:value={routeQuery}
										type="search"
										autocomplete="off"
										placeholder="/blog/:slug"
									/>
								</label>
								<div class="routes-list">
									{#each routeList as route}
										{@const latest = latestLoad(route)}
										<button
											class="route-row"
											class:active={selectedRouteData?.id === route.id}
											class:current={routeIsCurrent(route)}
											type="button"
											on:click={() => selectRoute(route)}
										>
											<span class="route-path">
												{#if routeIsCurrent(route)}<span class="route-dot"></span>{/if}{route.path}
											</span>
											<Badge tone={latest ? 'hot' : 'default'}
												>{latest ? `${latest.duration} ms` : route.files.length}</Badge
											>
										</button>
									{:else}
										<div class="empty">No routes found</div>
									{/each}
								</div>
							</aside>
							<section class="route-detail-panel">
								<div class="section-head">
									<div>
										<h2>Route simulator</h2>
										<p class="muted">Match a URL, preview params, and navigate the host app.</p>
									</div>
									<Badge>{routeMatches.length} matches</Badge>
								</div>
								<div class="route-actions">
									<input
										bind:value={routeInput}
										type="text"
										aria-label="Route input"
										on:keydown={(event) => event.key === 'Enter' && openRoute(routeInput)}
									/>
									<button type="button" on:click={() => openRoute(routeInput)}>Open route</button>
								</div>
								<div class="detail-grid">
									<article class="result-card">
										<h3>Matched route</h3>
										{#if routeMatches[0]}
											{@const match = matchRoutePath(routeMatches[0].path, routeInput)}
											<div class="meta-list">
												<MetaRow label="Route" value={routeMatches[0].path} />
												<MetaRow label="Params" value={json(match.params)} />
											</div>
										{:else}
											<div class="empty small">
												No route matches {normalizeRouteInput(routeInput)}
											</div>
										{/if}
									</article>
									<article class="result-card">
										<h3>All routes</h3>
										<div class="meta-list">
											{#each routeMatches as route}
												<MetaRow label={route.path} value={`${route.files.length} files`} />
											{:else}
												<div class="empty small">No matching route</div>
											{/each}
										</div>
									</article>
								</div>

								{#if selectedRouteData}
									{@const params = routePathParams(selectedRouteData.path)}
									{@const values = routeParamValues(selectedRouteData)}
									{@const loads = routeLoadEvents(state.loads, selectedRouteData)}
									{@const components = routeComponentUsages(
										state.components,
										selectedRouteData.path,
									)}
									<article class="route-detail">
										<h2>{selectedRouteData.path}</h2>
										<p class="muted">
											{selectedRouteData.files.length} files · {selectedRouteData.hasLoad
												? 'load tracked'
												: 'no load export found'}
										</p>
										{#if params.length}
											<div class="route-params">
												{#each params as param}
													<label>
														<span>{param.name} <em>{param.type}</em></span>
														<input
															value={values[param.name] ?? ''}
															on:input={(event) =>
																setRouteParam(selectedRouteData, param, event.currentTarget.value)}
														/>
													</label>
												{/each}
											</div>
										{/if}
										<div class="file-grid">
											{#each selectedRouteData.files as file}
												<FileCard
													file={file.path}
													title={file.name}
													badge={file.kind}
													warn={file.server}
													onOpen={openSourceFile}
												/>
											{/each}
										</div>
										{#if selectedRouteData.chain.length}
											<Panel
												title="Route chain"
												detail="Layouts, error boundaries, and leaf files used for this route"
											>
												<svelte:fragment slot="meta"
													><Badge>{selectedRouteData.chain.length} files</Badge></svelte:fragment
												>
												<div class="component-chain">
													{#each selectedRouteData.chain as file, index}
														<div class="component-chain-row" style={`margin-left:${index * 12}px`}>
															<div>
																<strong>{file.name}</strong>
																<p><code>{file.path}</code></p>
																<p class="muted">
																	{file.inherited ? 'Inherited from' : 'Defined on'}
																	{file.route}
																</p>
															</div>
															<Badge tone={file.inherited ? 'default' : 'hot'}>{file.kind}</Badge>
															<button type="button" on:click={() => openSourceFile(file.path)}
																>Open file</button
															>
														</div>
													{/each}
												</div>
											</Panel>
										{/if}
										{#if components.length}
											<Panel
												title="Components used by route"
												detail="Route Svelte files and local component imports"
											>
												<svelte:fragment slot="meta"
													><Badge>{components.length} components</Badge></svelte:fragment
												>
												<div class="component-chain">
													{#each components as usage}
														<div
															class="component-chain-row"
															style={`margin-left:${usage.depth * 18}px`}
														>
															<div>
																<strong>{usage.component.name}</strong>
																<p><code>{usage.component.file}</code></p>
															</div>
															<Badge tone={usage.component.kind === 'route' ? 'hot' : 'default'}
																>{usage.component.kind}</Badge
															>
															<button
																type="button"
																on:click={() => openSourceFile(usage.component.file)}
																>Open file</button
															>
														</div>
													{/each}
												</div>
											</Panel>
										{/if}
										{#if loads.length}
											<LoadList title="Recent loads for this route" events={loads} />
										{/if}
									</article>
								{:else}
									<div class="empty">No route selected</div>
								{/if}
							</section>
						</div>
					{:else if view === 'loads'}
						<div class="loads-head">
							<div>
								<h2>Load data</h2>
								<p class="muted">Recent load calls from page and layout modules.</p>
							</div>
							<Badge>{state.loads.length} events</Badge>
						</div>
						<LoadRows events={state.loads} empty="Visit routes to collect load data" />
					{:else if view === 'timeline'}
						<div class="section-head">
							<div>
								<h2>Timeline</h2>
								<p class="muted">Runtime load, hook, and remote calls in one stream.</p>
							</div>
							<div class="timeline-controls">
								<select bind:value={timelineKind}>
									<option value="all">All kinds</option>
									{#each timelineKinds as kind}<option value={kind}>{kind}</option>{/each}
								</select>
								<button
									type="button"
									on:click={() => {
										timelineRecording = !timelineRecording;
										timelineSnapshot = timelineRecording ? null : timelineEvents(state);
									}}
								>
									{timelineRecording ? 'Pause' : 'Record'}
								</button>
								<Badge>{timelineRows.length} events</Badge>
							</div>
						</div>
						<div class="load-list">
							{#each timelineRows as event}
								<article class="load-card">
									<div class="load-summary">
										<div>
											<strong>{event.label}</strong>
											<div class="muted">{new Date(event.startedAt).toLocaleTimeString()}</div>
										</div>
										<div>
											<code>{event.detail}</code>
											<div class="bar">
												<span
													style={`width:${Math.max(4, Math.round((event.duration / timelineMax) * 100))}%`}
												></span>
											</div>
										</div>
										<div>
											<strong>{event.duration} ms</strong>
											<div class="muted">{event.kind}</div>
										</div>
										<Badge tone={event.status === 'error' ? 'warn' : 'hot'}>{event.status}</Badge>
									</div>
								</article>
							{:else}
								<div class="empty">
									{timelineRecording
										? 'Visit routes or run remote calls to collect events'
										: 'Recording paused'}
								</div>
							{/each}
						</div>
					{:else if view === 'hooks'}
						<div class="section-head">
							<div>
								<h2>Hooks</h2>
								<p class="muted">SvelteKit server, client, and universal hooks.</p>
							</div>
							<Badge>{state.hooks.length} hooks · {state.hookEvents.length} calls</Badge>
						</div>
						<div class="detail-grid">
							{#each state.hooks as hook}
								<article class="result-card">
									<div class="section-head compact">
										<div>
											<h3>{hook.name}</h3>
											<p class="muted">{hook.file}</p>
										</div>
										<Badge tone={hook.instrumented ? 'hot' : 'default'}>{hook.environment}</Badge>
									</div>
									<button type="button" on:click={() => openSourceFile(hook.file)}>Open file</button
									>
									<div class="meta-list">
										<MetaRow
											label="Timing"
											value={hook.instrumented ? 'enabled' : 'not a function'}
										/>
									</div>
								</article>
							{:else}
								<div class="empty">No SvelteKit hooks found</div>
							{/each}
						</div>
						<Panel
							title="Recent hook calls"
							detail="Timing captured around exported hook functions"
						>
							<svelte:fragment slot="meta"
								><Badge>{state.hookEvents.length} calls</Badge></svelte:fragment
							>
							<div class="load-list">
								{#each state.hookEvents as event}
									<article class="load-card">
										<div class="load-summary">
											<div>
												<strong>{event.name}</strong>
												<div class="muted">{new Date(event.startedAt).toLocaleTimeString()}</div>
											</div>
											<div>
												<code>{event.file}</code>
												<div class="bar">
													<span
														style={`width:${Math.max(4, Math.round((event.duration / hookMax) * 100))}%`}
													></span>
												</div>
											</div>
											<div>
												<strong>{event.duration} ms</strong>
												<div class="muted">{event.environment}</div>
											</div>
											<Badge tone={event.status === 'error' ? 'warn' : 'hot'}>{event.status}</Badge>
										</div>
										{#if event.error}<pre class="json-view error-text">{event.error}</pre>{/if}
									</article>
								{:else}
									<div class="empty">Visit app routes to collect hook calls</div>
								{/each}
							</div>
						</Panel>
					{:else if view === 'imports'}
						<div class="section-head">
							<div>
								<h2>Imports</h2>
								<p class="muted">Source imports grouped by specifier and importing files.</p>
							</div>
							<Badge>{visibleImports.length} / {state.imports.length} specifiers</Badge>
						</div>
						<div class="toolbar">
							<input bind:value={importQuery} type="search" placeholder="Search imports" />
							<div class="select-tabs">
								{#each importTabs as tab}
									<button
										class:active={importKind === tab.value}
										type="button"
										on:click={() => (importKind = tab.value)}
									>
										{tab.label}<small>{importCounts[tab.value]}</small>
									</button>
								{/each}
							</div>
						</div>
						<div class="detail-grid">
							{#each visibleImports as item}
								<ImportCard {item} />
							{:else}
								<div class="empty">No imports found</div>
							{/each}
						</div>
					{:else if view === 'plugins'}
						<SimplePluginView plugins={state.project.vitePlugins} />
					{:else if view === 'runtime-config'}
						<div class="section-head">
							<div>
								<h2>Runtime config</h2>
								<p class="muted">Vite-exposed env and dev server runtime flags.</p>
							</div>
							<Badge>{state.runtimeConfig.env.length} vars</Badge>
						</div>
						<div class="detail-grid">
							<article class="result-card">
								<h3>App runtime</h3>
								<div class="meta-list">
									<MetaRow label="Mode" value={state.runtimeConfig.mode || 'unknown'} />
									<MetaRow label="Base" value={state.runtimeConfig.base || '/'} />
									<MetaRow
										label="Env prefix"
										value={state.runtimeConfig.envPrefix.join(', ') || 'none'}
									/>
								</div>
							</article>
							<article class="result-card">
								<h3>Public env</h3>
								<div class="meta-list">
									{#each state.runtimeConfig.env as item}
										<RuntimeEnvRow {item} />
									{:else}
										<div class="empty small">No Vite env found</div>
									{/each}
								</div>
							</article>
						</div>
					{:else if view === 'build-analyze'}
						<div class="section-head">
							<div>
								<h2>Build analyze</h2>
								<p class="muted">
									Run project build and inspect generated SvelteKit client assets.
								</p>
							</div>
							<button
								type="button"
								disabled={analysis.status === 'running'}
								on:click={runBuildAnalyze}
							>
								{analysis.status === 'running' ? 'Building' : 'Run build'}
							</button>
						</div>
						<div class="detail-grid">
							<article class="result-card">
								<h3>Summary</h3>
								<div class="meta-list">
									<MetaRow label="Status" value={analysis.status} />
									<MetaRow label="Total size" value={formatBytes(analysis.totalSize)} />
									<MetaRow label="Assets" value={String(analysis.assets.length)} />
									<MetaRow
										label="Duration"
										value={analysis.duration ? `${analysis.duration} ms` : '-'}
									/>
									<MetaRow label="Command" value={analysis.command ?? 'not run'} />
								</div>
							</article>
							<article class="result-card">
								<h3>{analysis.status === 'error' ? 'Error' : 'Output'}</h3>
								<pre
									class:error-text={analysis.status === 'error'}
									class="json-view">{analysis.error ??
										analysis.output ??
										'No build output yet'}</pre>
							</article>
						</div>
						<Panel title="Client assets" detail="Largest files from .svelte-kit/output/client">
							<svelte:fragment slot="meta"
								><Badge>{formatBytes(analysis.totalSize)}</Badge></svelte:fragment
							>
							<div class="load-list">
								{#each analysis.assets as asset}
									{@const width = analysis.totalSize
										? Math.max(4, Math.round((asset.size / analysis.totalSize) * 100))
										: 4}
									<article class="load-card">
										<div class="load-summary">
											<div>
												<strong>{asset.path}</strong>
												<div class="muted">{new Date(asset.mtime).toLocaleString()}</div>
											</div>
											<div>
												<code>{asset.type}</code>
												<div class="bar"><span style={`width:${width}%`}></span></div>
											</div>
											<div>
												<strong>{formatBytes(asset.size)}</strong>
												<div class="muted">
													{analysis.totalSize
														? Math.round((asset.size / analysis.totalSize) * 100)
														: 0}%
												</div>
											</div>
											<button type="button" on:click={() => openSourceFile(asset.path)}
												>Open file</button
											>
										</div>
									</article>
								{:else}
									<div class="empty">Run build analyze to collect assets</div>
								{/each}
							</div>
						</Panel>
					{:else if view === 'inspect'}
						<div class="section-head">
							<div>
								<h2>Inspect</h2>
								<p class="muted">Vite module graph from this dev server.</p>
							</div>
							<Badge>{graph.totalModules} modules</Badge>
						</div>
						<div class="detail-grid">
							<article class="result-card">
								<h3>Module graph</h3>
								<div class="meta-list">
									<MetaRow label="Total modules" value={String(graph.totalModules)} />
									<MetaRow label="Shown" value={String(graph.modules.length)} />
									<MetaRow label="Transformed" value={String(graph.transformedModules)} />
									<MetaRow label="HMR boundaries" value={String(graph.hmrBoundaries)} />
								</div>
							</article>
							<article class="result-card">
								<h3>By kind</h3>
								<div class="meta-list">
									{#each ['source', 'dependency', 'virtual', 'style', 'asset'] as kind}
										<MetaRow label={kind} value={String(moduleKindCount(graph, kind))} />
									{/each}
								</div>
							</article>
						</div>
						<div class="load-list">
							{#each graph.modules as module}
								<ModuleCard {module} {graph} onOpen={openSourceFile} />
							{:else}
								<div class="empty">Open app pages to populate the Vite module graph</div>
							{/each}
						</div>
					{:else if view === 'tasks'}
						<div class="section-head">
							<div>
								<h2>Tasks</h2>
								<p class="muted">Package scripts from this SvelteKit app.</p>
							</div>
							<Badge>{state.tasks.length} scripts · {state.taskRuns.length} runs</Badge>
						</div>
						<div class="detail-grid">
							{#each state.tasks as task}
								<TaskCard {task} running={runningTasks[task.name] === true} onRun={runTask} />
							{:else}
								<div class="empty">No package scripts found</div>
							{/each}
						</div>
						<Panel title="Recent runs" detail="Latest one-shot task output">
							<svelte:fragment slot="meta"
								><Badge>{state.taskRuns.length} runs</Badge></svelte:fragment
							>
							<div class="load-list">
								{#each state.taskRuns as run}
									<TaskRunCard {run} />
								{:else}
									<div class="empty">Run a task to capture output</div>
								{/each}
							</div>
						</Panel>
					{:else if view === 'open-graph'}
						<div class="section-head">
							<div>
								<h2>Open Graph</h2>
								<p class="muted">SEO tags from the current app page.</p>
							</div>
							<button type="button" on:click={requestSeoMeta}
								>{seoStatus === 'loading' ? 'Reading' : 'Refresh page meta'}</button
							>
						</div>
						<div class="route-actions">
							<input
								bind:value={seoRouteInput}
								type="text"
								aria-label="Open Graph route"
								on:keydown={(event) => event.key === 'Enter' && openRoute(seoRouteInput, true)}
							/>
							<button type="button" on:click={() => openRoute(seoRouteInput, true)}
								>Open and refresh</button
							>
						</div>
						{#if seoStatus === 'error'}
							<div class="empty">{seoError}</div>
						{:else if seoMeta}
							{@const missing = missingSeoItems(seoMeta)}
							{@const image = bestSeoImage(seoMeta)}
							<div class="detail-grid">
								<article class="result-card social-preview">
									{#if image}<img class="social-image" src={image} alt="" />{:else}<div
											class="social-image muted"
										>
											No image
										</div>{/if}
									<div>
										<p class="muted">{seoMeta.ogUrl || seoMeta.canonical || seoMeta.url}</p>
										<h3>{bestSeoTitle(seoMeta)}</h3>
										<p>{bestSeoDescription(seoMeta) || 'No description'}</p>
									</div>
								</article>
								<article class="result-card">
									<h3>Current page</h3>
									<div class="meta-list">
										<MetaRow label="Path" value={seoMeta.pathname} />
										<MetaRow label="Title" value={seoMeta.title || 'missing'} />
										<MetaRow label="Description" value={seoMeta.description || 'missing'} />
										<MetaRow label="Canonical" value={seoMeta.canonical || 'missing'} />
									</div>
								</article>
								<article class="result-card">
									<h3>Missing tags</h3>
									<div class="meta-list">
										{#each missing as item}
											<div class="meta-row">
												<span>{item.label}</span>
												<strong
													>{item.explanation}
													<a href={item.docsUrl} target="_blank" rel="noreferrer">Docs</a></strong
												>
											</div>
										{:else}
											<div class="empty small">No required tags missing</div>
										{/each}
									</div>
								</article>
								<article class="result-card">
									<h3>Resolved head tags</h3>
									<div class="meta-list">
										{#each normalizeSeoTags(seoMeta) as tag}
											<MetaRow label={`${tag.tag} ${tag.name}`} value={tag.value} />
										{:else}
											<div class="empty small">No head tags found</div>
										{/each}
									</div>
								</article>
							</div>
						{:else}
							<div class="empty">Open this tab in the dock to inspect the app page</div>
						{/if}
					{:else if view === 'remotes'}
						<div class="section-head">
							<div>
								<h2>Remote functions</h2>
								<p class="muted">Exports from .remote.js and .remote.ts modules.</p>
							</div>
							<Badge>{state.remotes.length} functions</Badge>
						</div>
						<div class="detail-grid">
							{#each state.remotes as remote}
								<RemoteCard
									{remote}
									input={remoteInputs[remote.id] ?? ''}
									result={remoteResults[remote.id] ?? { status: 'idle', text: 'No result yet' }}
									onInput={(value) => {
										remoteInputs = { ...remoteInputs, [remote.id]: value };
										pauseAutoRefresh();
									}}
									onRun={() => runRemote(remote)}
									onOpen={openSourceFile}
								/>
							{:else}
								<div class="empty">No remote functions found</div>
							{/each}
						</div>
						<Panel
							title="Recent remote calls"
							detail="Calls captured from SvelteKit remote handlers"
						>
							<svelte:fragment slot="meta"
								><Badge>{state.remoteCalls.length} calls</Badge></svelte:fragment
							>
							<div class="load-list">
								{#each state.remoteCalls as call}
									<article class="load-card">
										<div class="load-summary">
											<div>
												<strong>{call.name}</strong>
												<div class="muted">{new Date(call.startedAt).toLocaleTimeString()}</div>
											</div>
											<div>
												<code>{call.importPath}</code>
												<div class="bar">
													<span style={`width:${Math.min(100, Math.max(4, call.duration))}%`}
													></span>
												</div>
											</div>
											<div>
												<strong>{call.duration} ms</strong>
												<div class="muted">runtime</div>
											</div>
											<Badge tone={call.status === 'error' ? 'warn' : 'hot'}>{call.status}</Badge>
										</div>
										<div class="detail-grid">
											<TextCard title="Input" value={call.input} />
											<TextCard
												title={call.status === 'error' ? 'Error' : 'Output'}
												value={call.error ?? call.output ?? 'undefined'}
											/>
										</div>
									</article>
								{:else}
									<div class="empty">Run a remote function to collect calls</div>
								{/each}
							</div>
						</Panel>
					{:else if view === 'server-routes'}
						<div class="section-head">
							<div>
								<h2>Server routes</h2>
								<p class="muted">
									SvelteKit +server endpoints with a same-origin request playground.
								</p>
							</div>
							<Badge>{state.serverRoutes.length} routes</Badge>
						</div>
						<div class="detail-grid">
							{#each state.serverRoutes as route}
								<ServerRouteCard
									{route}
									method={serverRouteMethods[route.id] ?? route.methods[0] ?? 'GET'}
									path={serverRoutePaths[route.id] ?? defaultServerRoutePath(route)}
									headers={serverRouteHeaders[route.id] ?? '{}'}
									body={serverRouteBodies[route.id] ?? ''}
									result={serverRouteResults[route.id]}
									onMethod={(value) => {
										serverRouteMethods = { ...serverRouteMethods, [route.id]: value };
										pauseAutoRefresh();
									}}
									onPath={(value) => {
										serverRoutePaths = { ...serverRoutePaths, [route.id]: value };
										pauseAutoRefresh();
									}}
									onHeaders={(value) => {
										serverRouteHeaders = { ...serverRouteHeaders, [route.id]: value };
										pauseAutoRefresh();
									}}
									onBody={(value) => {
										serverRouteBodies = { ...serverRouteBodies, [route.id]: value };
										pauseAutoRefresh();
									}}
									onRun={() => runServerRoute(route)}
									onOpen={openSourceFile}
								/>
							{:else}
								<div class="empty">No server routes found</div>
							{/each}
						</div>
					{:else if view === 'actions'}
						<div class="section-head">
							<div>
								<h2>Actions</h2>
								<p class="muted">SvelteKit form actions from +page.server modules.</p>
							</div>
							<Badge>{state.routeActions.length} actions</Badge>
						</div>
						<div class="detail-grid">
							{#each state.routeActions as action}
								<ActionCard
									{action}
									input={actionInputs[action.id] ?? '{}'}
									requestPath={actionRequestPath(action)}
									result={actionResults[action.id]}
									onInput={(value) => {
										actionInputs = { ...actionInputs, [action.id]: value };
										pauseAutoRefresh();
									}}
									onRun={() => runAction(action)}
									onOpen={openSourceFile}
								/>
							{:else}
								<div class="empty">No form actions found</div>
							{/each}
						</div>
					{:else if view === 'assets'}
						<div class="section-head">
							<div>
								<h2>Assets</h2>
								<p class="muted">Files served from SvelteKit static.</p>
							</div>
							<Badge
								>{visibleAssets.length} / {state.assets.length} files · {formatBytes(
									state.assets.reduce((sum, asset) => sum + asset.size, 0),
								)}</Badge
							>
						</div>
						<div class="toolbar">
							<input bind:value={assetQuery} type="search" placeholder="Search assets" />
							<select bind:value={assetExtension}>
								<option value="all">All extensions</option>
								{#each assetExtensionOptions as ext}<option value={ext}>{ext}</option>{/each}
							</select>
							<div class="select-tabs">
								<button
									class:active={settings.assetsView === 'grid'}
									type="button"
									on:click={() => updateSettings({ assetsView: 'grid' })}>Grid</button
								>
								<button
									class:active={settings.assetsView === 'list'}
									type="button"
									on:click={() => updateSettings({ assetsView: 'list' })}>List</button
								>
							</div>
						</div>
						<div class:asset-list={settings.assetsView === 'list'} class="detail-grid">
							{#each visibleAssets as asset}
								<article
									class="result-card asset-card"
									class:selected={selectedAssetId === asset.id}
								>
									<AssetPreview {asset} />
									<div class="section-head compact">
										<div>
											<h3>{asset.url}</h3>
											<p class="muted">{asset.path}</p>
										</div>
										<Badge tone={asset.preview === 'image' ? 'hot' : 'default'}
											>{formatBytes(asset.size)}</Badge
										>
									</div>
									<div class="asset-actions">
										<button type="button" on:click={() => (selectedAssetId = asset.id)}
											>Details</button
										>
										<button type="button" on:click={() => openAsset(asset)}>Open asset</button>
										<button type="button" on:click={() => openSourceFile(asset.path)}
											>Open file</button
										>
									</div>
								</article>
							{:else}
								<div class="empty">No static assets found</div>
							{/each}
						</div>
						{#if selectedAsset}
							<aside class="drawer" transition:fly={{ x: 24, duration: 180 }}>
								<div class="section-head compact">
									<div>
										<h3>{selectedAsset.url}</h3>
										<p class="muted">{selectedAsset.path}</p>
									</div>
									<button type="button" on:click={() => (selectedAssetId = '')}>Close</button>
								</div>
								<AssetPreview asset={selectedAsset} />
								<div class="meta-list">
									<MetaRow label="Type" value={selectedAsset.type} />
									<MetaRow label="Size" value={formatBytes(selectedAsset.size)} />
									<MetaRow label="Updated" value={new Date(selectedAsset.mtime).toLocaleString()} />
								</div>
							</aside>
						{/if}
					{:else if view === 'components'}
						<div class="section-head">
							<div>
								<h2>Components</h2>
								<p class="muted">Svelte files in src, with props and local imports.</p>
							</div>
							<Badge>{visibleComponents.length} / {state.components.length} components</Badge>
						</div>
						<div class="toolbar">
							<input bind:value={componentQuery} type="search" placeholder="Search components" />
							<div class="select-tabs">
								<button
									class:active={settings.componentsView === 'list'}
									type="button"
									on:click={() => updateSettings({ componentsView: 'list' })}>List</button
								>
								<button
									class:active={settings.componentsView === 'graph'}
									type="button"
									on:click={() => updateSettings({ componentsView: 'graph' })}>Graph</button
								>
							</div>
						</div>
						{#if settings.componentsView === 'graph'}
							<div class="graph-layout">
								<article class="result-card graph-card">
									<ComponentGraph
										components={visibleComponents}
										selectedFile={selectedComponent?.file ?? ''}
										onSelect={(file) => (selectedComponentFile = file)}
									/>
								</article>
								{#if selectedComponent}
									<ComponentCard component={selectedComponent} onOpen={openSourceFile} />
								{/if}
							</div>
						{:else}
							{#if componentGraphEdges(state.components).length}
								<Panel title="Component graph" detail="Local component imports and route roots">
									<svelte:fragment slot="meta"
										><Badge>{componentGraphEdges(state.components).length} edges</Badge
										></svelte:fragment
									>
									<div class="component-chain">
										{#each componentGraphEdges(state.components) as edge}
											<div class="component-chain-row">
												<div>
													<strong>{edge.from.name} -> {edge.to.name}</strong>
													<p><code>{edge.from.file}</code> imports <code>{edge.to.file}</code></p>
												</div>
												<Badge tone={edge.from.kind === 'route' ? 'hot' : 'default'}
													>{edge.from.kind}</Badge
												>
												<button type="button" on:click={() => openSourceFile(edge.to.file)}
													>Open target</button
												>
											</div>
										{/each}
									</div>
								</Panel>
							{/if}
							<div class="detail-grid">
								{#each visibleComponents as component}
									<ComponentCard {component} onOpen={openSourceFile} />
								{:else}
									<div class="empty">No components found</div>
								{/each}
							</div>
						{/if}
					{:else if view === 'virtual-files'}
						<div class="section-head">
							<div>
								<h2>Virtual files</h2>
								<p class="muted">Generated files from .svelte-kit/generated.</p>
							</div>
							<Badge
								>{state.virtualFiles.length} files · {formatBytes(
									state.virtualFiles.reduce((sum, file) => sum + file.size, 0),
								)}</Badge
							>
						</div>
						<div class="virtual-file-list">
							{#each state.virtualFiles as file}
								<VirtualFileCard {file} onOpen={openSourceFile} />
							{:else}
								<div class="empty">Run SvelteKit once to generate files</div>
							{/each}
						</div>
					{:else if view === 'settings'}
						<div class="section-head">
							<div>
								<h2>Settings</h2>
								<p class="muted">Personal panel preferences stored in this browser.</p>
							</div>
							<button type="button" on:click={() => updateSettings(defaultDevtoolsSettings)}
								>Reset settings</button
							>
						</div>
						<div class="detail-grid">
							<article class="result-card">
								<h3>Interface</h3>
								<div class="tester">
									<label
										><span class="muted">Theme</span><select
											value={settings.theme}
											on:change={(event) =>
												updateSettings({
													theme: event.currentTarget.value as DevtoolsSettings['theme'],
												})}
											><option value="auto">Auto</option><option value="dark">Dark</option><option
												value="light">Light</option
											></select
										></label
									>
									<label
										><span class="muted">Scale</span><select
											value={settings.scale}
											on:change={(event) =>
												updateSettings({
													scale: event.currentTarget.value as DevtoolsSettings['scale'],
												})}
											><option value="90">90%</option><option value="100">100%</option><option
												value="110">110%</option
											></select
										></label
									>
									<label class="check-row"
										><input
											type="checkbox"
											checked={settings.compact}
											on:change={(event) =>
												updateSettings({ compact: event.currentTarget.checked })}
										/><span>Compact density</span></label
									>
									<label class="check-row"
										><input
											type="checkbox"
											checked={settings.sidebarExpanded}
											on:change={(event) =>
												updateSettings({ sidebarExpanded: event.currentTarget.checked })}
										/><span>Expanded sidebar</span></label
									>
									<label class="check-row"
										><input
											type="checkbox"
											checked={settings.sidebarScrollable}
											on:change={(event) =>
												updateSettings({ sidebarScrollable: event.currentTarget.checked })}
										/><span>Scrollable sidebar</span></label
									>
									<label
										><span class="muted">Editor (blank = auto-detect)</span><input
											value={settings.editor}
											placeholder="code, cursor, webstorm"
											on:change={(event) => updateSettings({ editor: event.currentTarget.value })}
										/></label
									>
								</div>
							</article>
							<article class="result-card">
								<h3>Categories</h3>
								<div class="settings-list">
									{#each navCategories as category}
										<label class="check-row">
											<input
												type="checkbox"
												checked={isCategoryVisible(settings, category.id)}
												on:change={(event) =>
													toggleHiddenCategory(category.id, !event.currentTarget.checked)}
											/>
											<span>{category.label}</span>
										</label>
									{/each}
								</div>
							</article>
							<article class="result-card">
								<h3>Views</h3>
								<div class="settings-list">
									{#each configurableViews as item}
										<label class="check-row">
											<input
												type="checkbox"
												checked={isViewVisible(settings, item)}
												on:change={(event) => toggleHiddenView(item, !event.currentTarget.checked)}
											/>
											<span>{viewLabels[item]}</span>
										</label>
									{/each}
								</div>
							</article>
							<article class="result-card">
								<h3>Pinned views</h3>
								<div class="settings-list">
									{#each configurableViews as item}
										<label class="check-row">
											<input
												type="checkbox"
												checked={settings.pinnedViews.includes(item)}
												on:change={(event) => togglePinnedView(item, event.currentTarget.checked)}
											/>
											<span>{viewLabels[item]}</span>
										</label>
									{/each}
								</div>
							</article>
						</div>
					{/if}
				</section>
			{/key}
		{/if}
	</main>
</div>

{#if paletteOpen}
	<div class="palette" transition:fade={{ duration: 120 }}>
		<div
			class="palette-backdrop"
			role="button"
			tabindex="0"
			aria-label="Close command palette"
			on:click={closePaletteFromBackdrop}
			on:keydown={closePaletteFromBackdrop}
		>
			<div class="palette-panel" role="dialog" aria-modal="true" aria-label="Command palette">
				<div class="palette-head">
					<input
						bind:this={paletteInput}
						bind:value={paletteQuery}
						type="search"
						autocomplete="off"
						placeholder="Search commands"
						on:input={() => (paletteIndex = 0)}
					/>
					<button type="button" on:click={() => (paletteOpen = false)}>Close</button>
				</div>
				<div class="palette-list">
					{#each paletteResults as command, index}
						<button
							class:active={index === paletteIndex}
							type="button"
							on:mouseenter={() => (paletteIndex = index)}
							on:click={() => runCommand(command.id)}
						>
							<span>{command.label}</span>
							<small>{command.group}</small>
						</button>
					{:else}
						<div class="empty small">No commands found</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
