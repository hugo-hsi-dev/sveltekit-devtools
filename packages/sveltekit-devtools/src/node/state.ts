import type { HookEvent, LoadEvent, RemoteCallEvent } from '../shared/types.js';

const STATE_KEY = '__SVELTEKIT_DEVTOOLS_STATE__';

interface RuntimeState {
	loads: LoadEvent[];
	remoteCalls: RemoteCallEvent[];
	hookEvents: HookEvent[];
}

function state(): RuntimeState {
	const global = globalThis as typeof globalThis & Record<string, RuntimeState | undefined>;
	global[STATE_KEY] ??= { loads: [], remoteCalls: [], hookEvents: [] };
	global[STATE_KEY].loads ??= [];
	global[STATE_KEY].remoteCalls ??= [];
	global[STATE_KEY].hookEvents ??= [];
	return global[STATE_KEY];
}

export function addLoadEvent(event: LoadEvent, max = 200) {
	const current = state().loads;
	current.unshift(event);
	if (current.length > max) current.length = max;
}

export function getLoadEvents() {
	return [...state().loads];
}

export function addRemoteCallEvent(event: RemoteCallEvent, max = 200) {
	const current = state().remoteCalls;
	current.unshift(event);
	if (current.length > max) current.length = max;
}

export function getRemoteCallEvents() {
	return [...state().remoteCalls];
}

export function addHookEvent(event: HookEvent, max = 200) {
	const current = state().hookEvents;
	current.unshift(event);
	if (current.length > max) current.length = max;
}

export function getHookEvents() {
	return [...state().hookEvents];
}

export function clearLoadEvents() {
	state().loads.length = 0;
}

export function runtimeModuleCode(maxLoadEvents: number, base = '/__sveltekit-devtools/') {
	return `
const STATE_KEY = '${STATE_KEY}';
const MAX_LOAD_EVENTS = ${maxLoadEvents};
const API_BASE = ${JSON.stringify(base)};

function getState() {
	globalThis[STATE_KEY] ||= { loads: [], remoteCalls: [], hookEvents: [] };
	globalThis[STATE_KEY].loads ||= [];
	globalThis[STATE_KEY].remoteCalls ||= [];
	globalThis[STATE_KEY].hookEvents ||= [];
	return globalThis[STATE_KEY];
}

function pickDataKeys(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
	return Object.keys(value).slice(0, 40);
}

function serializeValue(value) {
	if (value === undefined) {
		return { type: 'undefined', value: null, text: 'undefined', truncated: false };
	}
	const seen = new WeakSet();
	const raw = JSON.stringify(value, (key, item) => {
		if (typeof item === 'bigint') return item.toString() + 'n';
		if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack };
		if (typeof item === 'object' && item !== null) {
			if (seen.has(item)) return '[Circular]';
			seen.add(item);
		}
		if (typeof item === 'function') return '[Function]';
		if (typeof item === 'symbol') return String(item);
		return item;
	}, 2);
	const text = raw === undefined ? String(value) : raw;
	return {
		type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
		value: raw === undefined ? null : JSON.parse(raw || 'null'),
		text: text.length > 12000 ? text.slice(0, 12000) : text,
		truncated: text.length > 12000
	};
}

function normalizeError(error) {
	if (!error) return 'Unknown error';
	return error instanceof Error ? error.message : String(error);
}

function fetchUrl(input) {
	if (typeof input === 'string') return input;
	if (input?.href) return input.href;
	if (input?.url) return input.url;
	return String(input);
}

function fetchMethod(input, init) {
	return (init?.method || input?.method || 'GET').toUpperCase();
}

function urlPath(url, fallback) {
	if (url?.pathname) return url.pathname + (url.search || '');
	return fallback;
}

function queryParams(url) {
	if (!url?.searchParams) return {};
	const query = {};
	for (const [key, value] of url.searchParams) {
		query[key] ||= [];
		query[key].push(value);
	}
	return query;
}

function routeParams(event) {
	if (!event?.params || typeof event.params !== 'object') return {};
	return Object.fromEntries(
		Object.entries(event.params).map(([key, value]) => [key, String(value)])
	);
}

async function fetchResponseData(response) {
	const type = responseHeader(response, 'content-type');
	const length = Number(responseHeader(response, 'content-length') || 0);
	if (length > 12000) return serializeValue('[body skipped: ' + length + ' bytes]');
	if (type && !/(json|text|javascript|xml|html|form)/i.test(type)) return undefined;

	const text = await response.clone().text();
	if (/json/i.test(type) || /^[\\[{]/.test(text.trim())) {
		try {
			return serializeValue(JSON.parse(text));
		} catch {
			return serializeValue(text);
		}
	}
	return serializeValue(text);
}

function responseHeader(response, name) {
	try {
		return response.headers?.get?.(name) || '';
	} catch {
		return '';
	}
}

function trackEventFetch(event, fetches) {
	if (!event || typeof event.fetch !== 'function') return () => {};
	const original = event.fetch;

	event.fetch = async function trackedSvelteKitFetch(input, init) {
		const startedAt = Date.now();
		const item = {
			id: startedAt + ':' + Math.random().toString(36).slice(2),
			url: fetchUrl(input),
			method: fetchMethod(input, init),
			status: 0,
			statusText: '',
			startedAt,
			duration: 0
		};

		try {
			const response = await original.apply(this, arguments);
			item.status = response.status;
			item.statusText = response.statusText;
			try {
				const data = await fetchResponseData(response);
				if (data) item.response = data;
			} catch (error) {
				item.error = normalizeError(error);
			}
			return response;
		} catch (error) {
			item.statusText = 'error';
			item.error = normalizeError(error);
			throw error;
		} finally {
			item.duration = Date.now() - startedAt;
			fetches.push(item);
		}
	};

	return () => {
		event.fetch = original;
	};
}

function save(event) {
	const state = getState();
	state.loads.unshift(event);
	if (state.loads.length > MAX_LOAD_EVENTS) state.loads.length = MAX_LOAD_EVENTS;

	if (typeof window !== 'undefined' && typeof fetch === 'function') {
		fetch(API_BASE + 'api/load', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(event),
			keepalive: true
		}).catch(() => {});
	}
}

function saveRemote(event) {
	const state = getState();
	state.remoteCalls.unshift(event);
	if (state.remoteCalls.length > MAX_LOAD_EVENTS) state.remoteCalls.length = MAX_LOAD_EVENTS;

	if (typeof window !== 'undefined' && typeof fetch === 'function') {
		fetch(API_BASE + 'api/remote-call', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(event),
			keepalive: true
		}).catch(() => {});
	}
}

function saveHook(event) {
	const state = getState();
	state.hookEvents.unshift(event);
	if (state.hookEvents.length > MAX_LOAD_EVENTS) state.hookEvents.length = MAX_LOAD_EVENTS;

	if (typeof window !== 'undefined' && typeof fetch === 'function') {
		fetch(API_BASE + 'api/hook', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(event),
			keepalive: true
		}).catch(() => {});
	}
}

export function __sveltekitDevtoolsTrackLoad(meta, load) {
	return async function trackedSvelteKitLoad(...args) {
		const startedAt = Date.now();
		const event = args[0] || {};
		const source = typeof window === 'undefined' ? 'server' : 'client';
		const url = urlPath(event.url, event.route?.id || meta.route || '/');
		const params = routeParams(event);
		const query = queryParams(event.url);
		const fetches = [];
		const restoreFetch = trackEventFetch(event, fetches);

		try {
			const data = await load.apply(this, args);
			restoreFetch();
			save({
				id: startedAt + ':' + Math.random().toString(36).slice(2),
				route: meta.route,
				file: meta.file,
				url,
				params,
				query,
				source,
				status: 'success',
				startedAt,
				duration: Date.now() - startedAt,
				dataKeys: pickDataKeys(data),
				data: serializeValue(data),
				eventData: serializeValue(event.data),
				fetches
			});
			return data;
		} catch (error) {
			restoreFetch();
			save({
				id: startedAt + ':' + Math.random().toString(36).slice(2),
				route: meta.route,
				file: meta.file,
				url,
				params,
				query,
				source,
				status: 'error',
				startedAt,
				duration: Date.now() - startedAt,
				dataKeys: [],
				fetches,
				error: normalizeError(error)
			});
			throw error;
		}
	};
}

export function __sveltekitDevtoolsTrackRemote(meta, handler) {
	return async function trackedSvelteKitRemote(...args) {
		const startedAt = Date.now();

		try {
			const data = await handler.apply(this, args);
			saveRemote({
				id: startedAt + ':' + Math.random().toString(36).slice(2),
				name: meta.name,
				importPath: meta.importPath,
				status: 'success',
				startedAt,
				duration: Date.now() - startedAt,
				input: serializeRemoteInput(args),
				output: serializeValue(data).text
			});
			return data;
		} catch (error) {
			saveRemote({
				id: startedAt + ':' + Math.random().toString(36).slice(2),
				name: meta.name,
				importPath: meta.importPath,
				status: 'error',
				startedAt,
				duration: Date.now() - startedAt,
				input: serializeRemoteInput(args),
				error: normalizeError(error)
			});
			throw error;
		}
	};
}

export function __sveltekitDevtoolsTrackHook(meta, hook) {
	return function trackedSvelteKitHook(...args) {
		const startedAt = Date.now();

		try {
			const result = hook.apply(this, args);
			if (result && typeof result.then === 'function') {
				return result.then((value) => {
					saveHook(hookEvent(meta, args, startedAt, 'success'));
					return value;
				}, (error) => {
					saveHook(hookEvent(meta, args, startedAt, 'error', error));
					throw error;
				});
			}

			saveHook(hookEvent(meta, args, startedAt, 'success'));
			return result;
		} catch (error) {
			saveHook(hookEvent(meta, args, startedAt, 'error', error));
			throw error;
		}
	};
}

function hookEvent(meta, args, startedAt, status, error) {
	return {
		id: startedAt + ':' + Math.random().toString(36).slice(2),
		name: meta.name,
		file: meta.file,
		environment: meta.environment,
		status,
		startedAt,
		duration: Date.now() - startedAt,
		url: hookUrl(args),
		error: error ? normalizeError(error) : undefined
	};
}

function hookUrl(args) {
	const input = args[0] || {};
	const url = input.event?.url || input.url;
	if (url?.pathname) return url.pathname;
	if (input.request?.url) return input.request.url;
	return '';
}

function serializeRemoteInput(args) {
	if (args.length === 0) return 'undefined';
	return serializeValue(args.length === 1 ? args[0] : args).text;
}
`;
}
