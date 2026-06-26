<svelte:options runes={true} />

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
	const moduleKinds: ModuleGraphModuleInfo['kind'][] = [
		'source',
		'dependency',
		'virtual',
		'style',
		'asset',
	];
	const configurableViewSet = new Set<string>(configurableViews);

	let devtools = $state.raw<DevtoolsState>(emptyState());
	let view = $state<View>('overview');
	let status = $state({ text: 'Connecting', tone: '' });
	let loading = $state(true);
	let rpcPromise: Promise<any | null> | undefined;
	let settings = $state.raw(loadSettings());
	let hostTheme = $state<'dark' | 'light' | null>(null);
	let currentRoute = $state('');
	let pauseAutoRefreshUntil = 0;

	let selectedRoute = $state('');
	let routeQuery = $state('');
	let routeInput = $state('/');
	let routeParamInputs = $state.raw<Record<string, Record<string, string>>>({});

	let importQuery = $state('');
	let importKind = $state<ImportFilterKind>('all');
	let assetQuery = $state('');
	let assetExtension = $state('all');
	let selectedAssetId = $state('');
	let componentQuery = $state('');
	let selectedComponentFile = $state('');

	let remoteInputs = $state.raw<Record<string, string>>({});
	let remoteResults = $state.raw<Record<string, { status: RemoteRunState; text: string }>>({});
	let runningTasks = $state.raw<Record<string, boolean>>({});
	let serverRouteBodies = $state.raw<Record<string, string>>({});
	let serverRouteHeaders = $state.raw<Record<string, string>>({});
	let serverRouteMethods = $state.raw<Record<string, HttpMethod>>({});
	let serverRoutePaths = $state.raw<Record<string, string>>({});
	let serverRouteResults = $state.raw<Record<string, ServerRouteResult>>({});
	let actionInputs = $state.raw<Record<string, string>>({});
	let actionResults = $state.raw<Record<string, ActionResult>>({});

	let timelineKind = $state('all');
	let timelineRecording = $state(true);
	let timelineSnapshot = $state.raw<TimelineEvent[] | null>(null);

	let seoRouteInput = $state('/');
	let seoMeta = $state.raw<SeoMeta | null>(null);
	let seoStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let seoError = $state('');
	let pendingSeoRoute = $state('');

	let paletteOpen = $state(false);
	let paletteQuery = $state('');
	let paletteIndex = $state(0);
	let paletteInput = $state<HTMLInputElement>();

	let routeList = $derived(searchItems(devtools.routes, routeQuery, ['path', 'id']));
	let selectedRouteData = $derived(
		devtools.routes.find((route) => route.id === selectedRoute) ?? devtools.routes[0] ?? null,
	);
	let pinnedViews = $derived(settings.pinnedViews.filter(isConfigurableView));
	let routeMatches = $derived(
		matchedRoutes(devtools.routes, stripAppBase(routeInput || currentRoute || '/')),
	);
	let importCounts = $derived(importKindCounts(devtools.imports));
	let importsByFilter = $derived(filterImports(devtools.imports, { kind: importKind }));
	let visibleImports = $derived(
		searchItems(importsByFilter, importQuery, ['specifier', 'kind', 'importedBy']),
	);
	let assetExtensionOptions = $derived(assetExtensions(devtools.assets));
	let visibleAssets = $derived(
		searchItems(filterAssets(devtools.assets, { extension: assetExtension }), assetQuery, [
			'path',
			'url',
			'type',
			'preview',
		]),
	);
	let selectedAsset = $derived(
		devtools.assets.find((asset) => asset.id === selectedAssetId) ?? null,
	);
	let visibleComponents = $derived(
		searchItems(devtools.components, componentQuery, ['name', 'file', 'kind', 'route', 'props']),
	);
	let selectedComponent = $derived(
		devtools.components.find((component) => component.file === selectedComponentFile) ??
			visibleComponents[0] ??
			null,
	);
	let timelineSource = $derived(
		timelineRecording ? timelineEvents(devtools) : (timelineSnapshot ?? []),
	);
	let timelineKinds = $derived([...new Set(timelineSource.map((event) => event.kind))]);
	let timelineRows = $derived(
		timelineKind === 'all'
			? timelineSource
			: timelineSource.filter((event) => event.kind === timelineKind),
	);
	let timelineMax = $derived(Math.max(1, ...timelineRows.map((event) => event.duration)));
	let hookMax = $derived(Math.max(1, ...devtools.hookEvents.map((event) => event.duration)));
	let analysis = $derived(devtools.buildAnalysis);
	let graph = $derived(devtools.moduleGraph);
	let commandItems = $derived(buildCommandItems());
	let paletteResults = $derived(
		searchItems(commandItems, paletteQuery, ['label', 'group']).slice(0, 40),
	);
	$effect(() => {
		if (paletteIndex >= paletteResults.length) paletteIndex = 0;
	});
	$effect(() => {
		applySettings();
	});
	$effect(() => {
		if (paletteOpen) void focusPalette();
	});

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
			devtools = await readState();
			selectedRoute ||= devtools.routes[0]?.id ?? '';
			if (!routeInput || routeInput === '/') {
				routeInput = withAppBase(currentRoute || devtools.routes[0]?.path || '/');
			}
			if (!seoRouteInput || seoRouteInput === '/') seoRouteInput = withAppBase(currentRoute || '/');
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

	function isConfigurableView(item: string): item is View {
		return configurableViewSet.has(item);
	}

	function categoryViews(category: (typeof navCategories)[number]) {
		return category.views.filter((item) => isViewVisible(settings, item));
	}

	function buildCommandItems(): CommandItem[] {
		return [
			...allViews
				.filter((item) => canUseView(item))
				.map((item) => ({ id: `view:${item}`, label: viewLabels[item], group: 'View' })),
			...devtools.routes.map((route) => ({
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
			const route = devtools.routes.find((item) => item.id === id.slice('route:'.length));
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
		return withAppBase(fillRoutePath(route.path, routeParamValues(route)));
	}

	function routeParamValues(route: SvelteKitRoute) {
		const existing = routeParamInputs[route.id];
		if (existing) return existing;
		const values = Object.fromEntries(
			routePathParams(route.path).map((param) => [param.name, defaultRouteParamValue(param)]),
		);
		routeParamInputs = { ...routeParamInputs, [route.id]: values };
		return values;
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
		const next = withAppBase(path);
		if (window.parent === window) {
			if (refreshSeo) {
				seoStatus = 'error';
				seoError = 'Open Graph refresh requires the docked app page.';
				setStatus('Open Graph needs dock mode', 'error');
				return;
			}
			location.assign(next);
			return;
		}
		if (refreshSeo) pendingSeoRoute = next;
		window.parent.postMessage({ type: 'sveltekit-devtools:navigate', path: next }, location.origin);
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
		devtools = {
			...devtools,
			buildAnalysis: { status: 'running', startedAt: Date.now(), totalSize: 0, assets: [] },
		};
		const response = await fetch(api('build-analyze'), { method: 'POST' });
		if (!response.ok) throw new Error('Build analyze failed');
		devtools = { ...devtools, buildAnalysis: (await response.json()) as BuildAnalysis };
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
			devtools = {
				...devtools,
				taskRuns: [result, ...devtools.taskRuns.filter((run) => run.id !== result.id)],
			};
		} catch (error) {
			const startedAt = Date.now();
			devtools = {
				...devtools,
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
					...devtools.taskRuns,
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
		const path = withAppBase(fillRoutePath(action.path, values));
		return action.default ? path : `${path}?/${encodeURIComponent(action.name)}`;
	}

	function defaultServerRoutePath(route: ServerRouteInfo) {
		const values = Object.fromEntries(
			routePathParams(route.path).map((param) => [param.name, defaultRouteParamValue(param)]),
		);
		return withAppBase(fillRoutePath(route.path, values));
	}

	async function openSourceFile(file: string, line?: number, column?: number) {
		if (!file) return;
		const target = file.startsWith('/') ? file : `${devtools.root}/${file}`;
		const positioned = line ? `${target}:${line}${column ? `:${column}` : ''}` : target;
		try {
			const rpc = await rpcClient();
			if (rpc) {
				await rpc.call('vite:core:open-in-editor', positioned);
			} else {
				const response = await fetch(api('open-in-editor'), {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						file: target,
						line,
						column,
						editor: settings.editor || undefined,
					}),
				});
				if (!response.ok) throw new Error('Open in editor failed');
			}
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
		settings = setHiddenView(settings, item, hidden, configurableViews, configurableCategories);
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
		if (typeof data.route === 'string') {
			const route = withAppBase(data.route);
			if (route !== currentRoute) {
				currentRoute = route;
				if (!routeInput || routeInput === '/') routeInput = route;
				if (!seoRouteInput || seoRouteInput === '/') seoRouteInput = route;
			}
			if (pendingSeoRoute && route === pendingSeoRoute) {
				pendingSeoRoute = '';
				void requestSeoMeta();
			}
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
		return currentRoute ? routeMatchesPath(route.path, stripAppBase(currentRoute)) : false;
	}

	function appBase() {
		const base = devtools.runtimeConfig.base || '/';
		if (base === '/') return '';
		return `/${base.replace(/^\/|\/$/g, '')}`;
	}

	function withAppBase(path: string) {
		const value = normalizeRouteInput(path);
		const base = appBase();
		if (!base || value === base || value.startsWith(`${base}/`)) return value;
		return `${base}${value}`;
	}

	function stripAppBase(path: string) {
		const value = normalizeRouteInput(path);
		const base = appBase();
		if (!base) return value;
		if (value === base) return '/';
		return value.startsWith(`${base}/`) ? value.slice(base.length) : value;
	}

	function latestLoad(route: SvelteKitRoute) {
		return routeLoadEvents(devtools.loads, route)[0];
	}

	function loadFetchCount() {
		return devtools.loads.reduce((count, event) => count + (event.fetches?.length ?? 0), 0);
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

<svelte:window onmessage={handleHostMessage} onkeydown={handleKeydown} />

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
			onclick={() => setView('overview')}
		>
			<span class="sidebar-icon">{@html icons.overview}</span>
			<span class="sidebar-label">Overview</span>
		</button>

		{#if settings.pinnedViews.length}
			<div class="sidebar-category">
				<span>Pinned</span>
				{#each pinnedViews.filter((item) => isViewVisible(settings, item)) as item (item)}
					<button
						class="sidebar-row"
						class:active={view === item}
						type="button"
						title={viewLabels[item]}
						onclick={() => setView(item)}
					>
						<span class="sidebar-icon">{@html icons[viewIcons[item]]}</span>
						<span class="sidebar-label">{viewLabels[item]}</span>
					</button>
				{/each}
			</div>
		{/if}

		{#each navCategories as category (category.id)}
			{#if isCategoryVisible(settings, category.id)}
				<div class="sidebar-category">
					<span>{category.label}</span>
					{#each categoryViews(category) as item (item)}
						<button
							class="sidebar-row"
							class:active={view === item}
							type="button"
							title={viewLabels[item]}
							onclick={() => setView(item)}
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
			onclick={() => updateSettings({ sidebarExpanded: !settings.sidebarExpanded })}
		>
			<span class="sidebar-icon">⇤</span>
			<span class="sidebar-label">Collapse</span>
		</button>
		<button
			class="sidebar-row"
			class:active={view === 'settings'}
			type="button"
			title="Settings"
			onclick={() => setView('settings')}
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
					<p class="muted">{devtools.project.name || devtools.root || 'SvelteKit app'}</p>
				</div>
			</div>
			<div class="actions">
				<span class="status {status.tone}">{status.text}</span>
				<button type="button" onclick={() => (paletteOpen = true)}>Commands</button>
				<button class="icon-button" type="button" title="Refresh" onclick={() => refresh()}
					>↻</button
				>
				{#if view === 'loads'}
					<button type="button" onclick={clearLoads}>Clear loads</button>
				{/if}
			</div>
		</header>

		{#if loading && !devtools.generatedAt}
			<div class="view"><Loading>Loading devtools state</Loading></div>
		{:else}
			{#key view}
				<section class="view" in:fly={{ y: 6, duration: 160 }} out:fade={{ duration: 80 }}>
					{#if view === 'overview'}
						<div class="section-head">
							<div>
								<h2>{devtools.project.name || 'Project'}</h2>
								<p class="muted">{devtools.root}</p>
							</div>
							<Badge>{devtools.project.version || 'dev'}</Badge>
						</div>
						<div class="detail-grid">
							<article class="result-card">
								<h3>Project</h3>
								<div class="meta-list">
									<MetaRow
										label="Package manager"
										value={devtools.project.packageManager || 'unknown'}
									/>
									<MetaRow label="Routes" value={String(devtools.routes.length)} />
									<MetaRow label="Load fetches" value={String(loadFetchCount())} />
									<MetaRow label="Hooks" value={String(devtools.hooks.length)} />
									<MetaRow label="Components" value={String(devtools.components.length)} />
									<MetaRow label="Imports" value={String(devtools.imports.length)} />
									<MetaRow label="Assets" value={String(devtools.assets.length)} />
									<MetaRow label="Server routes" value={String(devtools.serverRoutes.length)} />
									<MetaRow label="Actions" value={String(devtools.routeActions.length)} />
									<MetaRow label="Remotes" value={String(devtools.remotes.length)} />
									<MetaRow label="Virtual files" value={String(devtools.virtualFiles.length)} />
									<MetaRow
										label="Build size"
										value={formatBytes(devtools.buildAnalysis.totalSize)}
									/>
								</div>
							</article>
							<article class="result-card">
								<h3>Core packages</h3>
								<div class="meta-list">
									{#each devtools.project.dependencies.filter( (dep) => ['@sveltejs/kit', 'svelte', 'vite', 'sveltekit-devtools'].includes(dep.name), ) as dep (dep.name)}
										<MetaRow label={dep.name} value={`${dep.version} · ${dep.type}`} />
									{:else}
										<div class="empty small">No SvelteKit packages found</div>
									{/each}
								</div>
							</article>
						</div>
						<Panel title="Vite plugins" detail="Plugins active in this dev server">
							{#snippet meta()}<Badge>{devtools.project.vitePlugins.length} plugins</Badge
								>{/snippet}
							<div class="detail-grid">
								{#each devtools.project.vitePlugins.slice(0, 24) as plugin (`${plugin.name}:${plugin.enforce}:${plugin.apply}`)}
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
									{#each routeList as route (route.id)}
										{@const latest = latestLoad(route)}
										<button
											class="route-row"
											class:active={selectedRouteData?.id === route.id}
											class:current={routeIsCurrent(route)}
											type="button"
											onclick={() => selectRoute(route)}
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
										onkeydown={(event) => event.key === 'Enter' && openRoute(routeInput)}
									/>
									<button type="button" onclick={() => openRoute(routeInput)}>Open route</button>
								</div>
								<div class="detail-grid">
									<article class="result-card">
										<h3>Matched route</h3>
										{#if routeMatches[0]}
											{@const match = matchRoutePath(
												routeMatches[0].path,
												stripAppBase(routeInput),
											)}
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
											{#each routeMatches as route (route.id)}
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
									{@const loads = routeLoadEvents(devtools.loads, selectedRouteData)}
									{@const components = routeComponentUsages(
										devtools.components,
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
												{#each params as param (param.name)}
													<label>
														<span>{param.name} <em>{param.type}</em></span>
														<input
															value={values[param.name] ?? ''}
															oninput={(event) =>
																setRouteParam(selectedRouteData, param, event.currentTarget.value)}
														/>
													</label>
												{/each}
											</div>
										{/if}
										<div class="file-grid">
											{#each selectedRouteData.files as file (file.path)}
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
												{#snippet meta()}<Badge>{selectedRouteData.chain.length} files</Badge
													>{/snippet}
												<div class="component-chain">
													{#each selectedRouteData.chain as file, index (file.path)}
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
															<button type="button" onclick={() => openSourceFile(file.path)}
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
												{#snippet meta()}<Badge>{components.length} components</Badge>{/snippet}
												<div class="component-chain">
													{#each components as usage (usage.component.file)}
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
																onclick={() => openSourceFile(usage.component.file)}
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
							<Badge>{devtools.loads.length} events</Badge>
						</div>
						<LoadRows events={devtools.loads} empty="Visit routes to collect load data" />
					{:else if view === 'timeline'}
						<div class="section-head">
							<div>
								<h2>Timeline</h2>
								<p class="muted">Runtime load, hook, and remote calls in one stream.</p>
							</div>
							<div class="timeline-controls">
								<select bind:value={timelineKind}>
									<option value="all">All kinds</option>
									{#each timelineKinds as kind (kind)}<option value={kind}>{kind}</option>{/each}
								</select>
								<button
									type="button"
									onclick={() => {
										timelineRecording = !timelineRecording;
										timelineSnapshot = timelineRecording ? null : timelineEvents(devtools);
									}}
								>
									{timelineRecording ? 'Pause' : 'Record'}
								</button>
								<Badge>{timelineRows.length} events</Badge>
							</div>
						</div>
						<div class="load-list">
							{#each timelineRows as event (event.id)}
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
							<Badge>{devtools.hooks.length} hooks · {devtools.hookEvents.length} calls</Badge>
						</div>
						<div class="detail-grid">
							{#each devtools.hooks as hook (hook.id)}
								<article class="result-card">
									<div class="section-head compact">
										<div>
											<h3>{hook.name}</h3>
											<p class="muted">{hook.file}</p>
										</div>
										<Badge tone={hook.instrumented ? 'hot' : 'default'}>{hook.environment}</Badge>
									</div>
									<button type="button" onclick={() => openSourceFile(hook.file)}>Open file</button>
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
							{#snippet meta()}<Badge>{devtools.hookEvents.length} calls</Badge>{/snippet}
							<div class="load-list">
								{#each devtools.hookEvents as event (event.id)}
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
							<Badge>{visibleImports.length} / {devtools.imports.length} specifiers</Badge>
						</div>
						<div class="toolbar">
							<input bind:value={importQuery} type="search" placeholder="Search imports" />
							<div class="select-tabs">
								{#each importTabs as tab (tab.value)}
									<button
										class:active={importKind === tab.value}
										type="button"
										onclick={() => (importKind = tab.value)}
									>
										{tab.label}<small>{importCounts[tab.value]}</small>
									</button>
								{/each}
							</div>
						</div>
						<div class="detail-grid">
							{#each visibleImports as item (item.id)}
								<ImportCard {item} />
							{:else}
								<div class="empty">No imports found</div>
							{/each}
						</div>
					{:else if view === 'plugins'}
						<SimplePluginView plugins={devtools.project.vitePlugins} />
					{:else if view === 'runtime-config'}
						<div class="section-head">
							<div>
								<h2>Runtime config</h2>
								<p class="muted">Vite-exposed env and dev server runtime flags.</p>
							</div>
							<Badge>{devtools.runtimeConfig.env.length} vars</Badge>
						</div>
						<div class="detail-grid">
							<article class="result-card">
								<h3>App runtime</h3>
								<div class="meta-list">
									<MetaRow label="Mode" value={devtools.runtimeConfig.mode || 'unknown'} />
									<MetaRow label="Base" value={devtools.runtimeConfig.base || '/'} />
									<MetaRow
										label="Env prefix"
										value={devtools.runtimeConfig.envPrefix.join(', ') || 'none'}
									/>
								</div>
							</article>
							<article class="result-card">
								<h3>Public env</h3>
								<div class="meta-list">
									{#each devtools.runtimeConfig.env as item (item.name)}
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
								onclick={runBuildAnalyze}
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
							{#snippet meta()}<Badge>{formatBytes(analysis.totalSize)}</Badge>{/snippet}
							<div class="load-list">
								{#each analysis.assets as asset (asset.path)}
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
											<button type="button" onclick={() => openSourceFile(asset.path)}
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
									{#each moduleKinds as kind (kind)}
										<MetaRow label={kind} value={String(moduleKindCount(graph, kind))} />
									{/each}
								</div>
							</article>
						</div>
						<div class="load-list">
							{#each graph.modules as module (module.id)}
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
							<Badge>{devtools.tasks.length} scripts · {devtools.taskRuns.length} runs</Badge>
						</div>
						<div class="detail-grid">
							{#each devtools.tasks as task (task.name)}
								<TaskCard {task} running={runningTasks[task.name] === true} onRun={runTask} />
							{:else}
								<div class="empty">No package scripts found</div>
							{/each}
						</div>
						<Panel title="Recent runs" detail="Latest one-shot task output">
							{#snippet meta()}<Badge>{devtools.taskRuns.length} runs</Badge>{/snippet}
							<div class="load-list">
								{#each devtools.taskRuns as run (run.id)}
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
							<button type="button" onclick={requestSeoMeta}
								>{seoStatus === 'loading' ? 'Reading' : 'Refresh page meta'}</button
							>
						</div>
						<div class="route-actions">
							<input
								bind:value={seoRouteInput}
								type="text"
								aria-label="Open Graph route"
								onkeydown={(event) => event.key === 'Enter' && openRoute(seoRouteInput, true)}
							/>
							<button type="button" onclick={() => openRoute(seoRouteInput, true)}
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
										{#each missing as item (item.key)}
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
										{#each normalizeSeoTags(seoMeta) as tag (`${tag.tag}:${tag.name}:${tag.value}`)}
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
							<Badge>{devtools.remotes.length} functions</Badge>
						</div>
						<div class="detail-grid">
							{#each devtools.remotes as remote (remote.id)}
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
							{#snippet meta()}<Badge>{devtools.remoteCalls.length} calls</Badge>{/snippet}
							<div class="load-list">
								{#each devtools.remoteCalls as call (call.id)}
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
							<Badge>{devtools.serverRoutes.length} routes</Badge>
						</div>
						<div class="detail-grid">
							{#each devtools.serverRoutes as route (route.id)}
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
							<Badge>{devtools.routeActions.length} actions</Badge>
						</div>
						<div class="detail-grid">
							{#each devtools.routeActions as action (action.id)}
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
								>{visibleAssets.length} / {devtools.assets.length} files · {formatBytes(
									devtools.assets.reduce((sum, asset) => sum + asset.size, 0),
								)}</Badge
							>
						</div>
						<div class="toolbar">
							<input bind:value={assetQuery} type="search" placeholder="Search assets" />
							<select bind:value={assetExtension}>
								<option value="all">All extensions</option>
								{#each assetExtensionOptions as ext (ext)}<option value={ext}>{ext}</option>{/each}
							</select>
							<div class="select-tabs">
								<button
									class:active={settings.assetsView === 'grid'}
									type="button"
									onclick={() => updateSettings({ assetsView: 'grid' })}>Grid</button
								>
								<button
									class:active={settings.assetsView === 'list'}
									type="button"
									onclick={() => updateSettings({ assetsView: 'list' })}>List</button
								>
							</div>
						</div>
						<div class:asset-list={settings.assetsView === 'list'} class="detail-grid">
							{#each visibleAssets as asset (asset.id)}
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
										<button type="button" onclick={() => (selectedAssetId = asset.id)}
											>Details</button
										>
										<button type="button" onclick={() => openAsset(asset)}>Open asset</button>
										<button type="button" onclick={() => openSourceFile(asset.path)}
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
									<button type="button" onclick={() => (selectedAssetId = '')}>Close</button>
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
							<Badge>{visibleComponents.length} / {devtools.components.length} components</Badge>
						</div>
						<div class="toolbar">
							<input bind:value={componentQuery} type="search" placeholder="Search components" />
							<div class="select-tabs">
								<button
									class:active={settings.componentsView === 'list'}
									type="button"
									onclick={() => updateSettings({ componentsView: 'list' })}>List</button
								>
								<button
									class:active={settings.componentsView === 'graph'}
									type="button"
									onclick={() => updateSettings({ componentsView: 'graph' })}>Graph</button
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
							{#if componentGraphEdges(devtools.components).length}
								<Panel title="Component graph" detail="Local component imports and route roots">
									{#snippet meta()}<Badge
											>{componentGraphEdges(devtools.components).length} edges</Badge
										>{/snippet}
									<div class="component-chain">
										{#each componentGraphEdges(devtools.components) as edge (`${edge.from.file}->${edge.to.file}`)}
											<div class="component-chain-row">
												<div>
													<strong>{edge.from.name} -> {edge.to.name}</strong>
													<p><code>{edge.from.file}</code> imports <code>{edge.to.file}</code></p>
												</div>
												<Badge tone={edge.from.kind === 'route' ? 'hot' : 'default'}
													>{edge.from.kind}</Badge
												>
												<button type="button" onclick={() => openSourceFile(edge.to.file)}
													>Open target</button
												>
											</div>
										{/each}
									</div>
								</Panel>
							{/if}
							<div class="detail-grid">
								{#each visibleComponents as component (component.file)}
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
								>{devtools.virtualFiles.length} files · {formatBytes(
									devtools.virtualFiles.reduce((sum, file) => sum + file.size, 0),
								)}</Badge
							>
						</div>
						<div class="virtual-file-list">
							{#each devtools.virtualFiles as file (file.path)}
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
							<button type="button" onclick={() => updateSettings(defaultDevtoolsSettings)}
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
											onchange={(event) =>
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
											onchange={(event) =>
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
											onchange={(event) => updateSettings({ compact: event.currentTarget.checked })}
										/><span>Compact density</span></label
									>
									<label class="check-row"
										><input
											type="checkbox"
											checked={settings.sidebarExpanded}
											onchange={(event) =>
												updateSettings({ sidebarExpanded: event.currentTarget.checked })}
										/><span>Expanded sidebar</span></label
									>
									<label class="check-row"
										><input
											type="checkbox"
											checked={settings.sidebarScrollable}
											onchange={(event) =>
												updateSettings({ sidebarScrollable: event.currentTarget.checked })}
										/><span>Scrollable sidebar</span></label
									>
									<label
										><span class="muted">Editor (blank = auto-detect)</span><input
											value={settings.editor}
											placeholder="code, cursor, webstorm"
											onchange={(event) => updateSettings({ editor: event.currentTarget.value })}
										/></label
									>
								</div>
							</article>
							<article class="result-card">
								<h3>Categories</h3>
								<div class="settings-list">
									{#each navCategories as category (category.id)}
										<label class="check-row">
											<input
												type="checkbox"
												checked={isCategoryVisible(settings, category.id)}
												onchange={(event) =>
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
									{#each configurableViews as item (item)}
										<label class="check-row">
											<input
												type="checkbox"
												checked={isViewVisible(settings, item)}
												onchange={(event) => toggleHiddenView(item, !event.currentTarget.checked)}
											/>
											<span>{viewLabels[item]}</span>
										</label>
									{/each}
								</div>
							</article>
							<article class="result-card">
								<h3>Pinned views</h3>
								<div class="settings-list">
									{#each configurableViews as item (item)}
										<label class="check-row">
											<input
												type="checkbox"
												checked={settings.pinnedViews.includes(item)}
												onchange={(event) => togglePinnedView(item, event.currentTarget.checked)}
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
			onclick={closePaletteFromBackdrop}
			onkeydown={closePaletteFromBackdrop}
		>
			<div class="palette-panel" role="dialog" aria-modal="true" aria-label="Command palette">
				<div class="palette-head">
					<input
						bind:this={paletteInput}
						bind:value={paletteQuery}
						type="search"
						autocomplete="off"
						placeholder="Search commands"
						oninput={() => (paletteIndex = 0)}
					/>
					<button type="button" onclick={() => (paletteOpen = false)}>Close</button>
				</div>
				<div class="palette-list">
					{#each paletteResults as command, index (command.id)}
						<button
							class:active={index === paletteIndex}
							type="button"
							onmouseenter={() => (paletteIndex = index)}
							onclick={() => runCommand(command.id)}
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
