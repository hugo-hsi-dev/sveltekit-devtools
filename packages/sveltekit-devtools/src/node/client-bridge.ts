export function clientBridgeModuleCode() {
	return `
const REQUEST = 'sveltekit-devtools:remote-call';
const RESPONSE = 'sveltekit-devtools:remote-result';
const NAVIGATE = 'sveltekit-devtools:navigate';
const SEO_REQUEST = 'sveltekit-devtools:seo-meta';
const SEO_RESPONSE = 'sveltekit-devtools:seo-meta-result';

if (!globalThis.__SVELTEKIT_DEVTOOLS_BRIDGE__) {
	Object.defineProperty(globalThis, '__SVELTEKIT_DEVTOOLS_BRIDGE__', { value: true });

	window.addEventListener('message', async (event) => {
		if (event.origin !== location.origin) return;
		if (!event.data) return;

		if (event.data.type === NAVIGATE) {
			location.assign(event.data.path);
			return;
		}

		if (event.data.type === SEO_REQUEST) {
			event.source?.postMessage(
				{ type: SEO_RESPONSE, requestId: event.data.requestId, meta: readSeoMeta() },
				event.origin
			);
			return;
		}

		if (event.data.type !== REQUEST) return;

		const { requestId, remote, input } = event.data;
		try {
			const module = await import(/* @vite-ignore */ remote.importPath + '?sveltekit_devtools=' + Date.now());
			const fn = module[remote.name];
			if (typeof fn !== 'function') throw new Error('Export ' + remote.name + ' is not callable');

			const result = input.hasValue ? fn(input.value) : fn();
			const value = await unwrapRemoteResult(result);
			const text = serializeUnknown(value);
			event.source?.postMessage(
				{ type: RESPONSE, requestId, ok: true, text },
				event.origin
			);
		} catch (error) {
			const message = errorMessage(error);
			event.source?.postMessage(
				{ type: RESPONSE, requestId, ok: false, text: message },
				event.origin
			);
		}
	});
}

async function unwrapRemoteResult(value) {
	if (isThenable(value)) return await value;
	if (value && typeof value === 'object' && 'current' in value) return value.current;
	return value;
}

function isThenable(value) {
	return Boolean(
		value &&
			(typeof value === 'object' || typeof value === 'function') &&
			'then' in value &&
			typeof value.then === 'function'
	);
}

function serializeUnknown(value) {
	if (value === undefined) return 'undefined';
	const seen = new WeakSet();
	const json = JSON.stringify(
		value,
		(_key, item) => {
			if (typeof item === 'bigint') return item + 'n';
			if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack };
			if (typeof item === 'object' && item !== null) {
				if (seen.has(item)) return '[Circular]';
				seen.add(item);
			}
			if (typeof item === 'function') return '[Function]';
			if (typeof item === 'symbol') return String(item);
			return item;
		},
		2
	);
	return json ?? String(value);
}

function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

function readSeoMeta() {
	return {
		url: location.href,
		pathname: location.pathname,
		title: document.title,
		description: meta('name', 'description'),
		canonical: link('canonical'),
		ogTitle: meta('property', 'og:title'),
		ogDescription: meta('property', 'og:description'),
		ogImage: meta('property', 'og:image'),
		ogUrl: meta('property', 'og:url'),
		ogType: meta('property', 'og:type'),
		twitterCard: meta('name', 'twitter:card'),
		twitterTitle: meta('name', 'twitter:title'),
		twitterDescription: meta('name', 'twitter:description'),
		twitterImage: meta('name', 'twitter:image')
	};
}

function meta(attribute, value) {
	return document.querySelector('meta[' + attribute + '="' + value + '"]')?.getAttribute('content') || '';
}

function link(rel) {
	return document.querySelector('link[rel="' + rel + '"]')?.getAttribute('href') || '';
}

`;
}
