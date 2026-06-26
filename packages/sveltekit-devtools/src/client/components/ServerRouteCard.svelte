<script lang="ts">
	import type { HttpMethod, ServerRouteInfo } from '../../shared/types';
	import type { ServerRouteResult } from '../shared/view-context';
	import Badge from './Badge.svelte';

	let {
		route,
		method = route.methods[0] ?? 'GET',
		path = route.path,
		headers = '{}',
		body = '',
		result,
		onMethod = () => {},
		onPath = () => {},
		onHeaders = () => {},
		onBody = () => {},
		onRun = () => {},
		onOpen = () => {},
	}: {
		route: ServerRouteInfo;
		method?: HttpMethod;
		path?: string;
		headers?: string;
		body?: string;
		result?: ServerRouteResult;
		onMethod?: (value: HttpMethod) => void;
		onPath?: (value: string) => void;
		onHeaders?: (value: string) => void;
		onBody?: (value: string) => void;
		onRun?: () => void;
		onOpen?: (file: string) => void;
	} = $props();

	let methods = $derived(route.methods.length ? route.methods : (['GET'] as HttpMethod[]));
	let resultText = $derived(
		result
			? (result.error ??
					JSON.stringify(
						{
							status: `${result.status || '-'} ${result.statusText}`,
							duration: `${result.duration} ms`,
							headers: result.headers,
							body: result.body,
						},
						null,
						2,
					))
			: 'No response yet',
	);
</script>

<article class="result-card">
	<div class="section-head compact">
		<div>
			<h3>{route.path}</h3>
			<p class="muted">{route.file}</p>
		</div>
		<Badge tone="hot">{route.methods.length ? route.methods.join(', ') : 'no methods'}</Badge>
	</div>
	<button type="button" onclick={() => onOpen(route.file)}>Open file</button>
	<div class="tester">
		<div class="request-row">
			<select
				value={method}
				onchange={(event) => onMethod(event.currentTarget.value as HttpMethod)}
			>
				{#each methods as item (item)}<option value={item}>{item}</option>{/each}
			</select>
			<input
				value={path}
				aria-label="Request path"
				oninput={(event) => onPath(event.currentTarget.value)}
			/>
			<button type="button" onclick={onRun}>Send</button>
		</div>
		<label
			><span class="muted">Headers JSON</span><textarea
				value={headers}
				oninput={(event) => onHeaders(event.currentTarget.value)}></textarea></label
		>
		<label
			><span class="muted">Body</span><textarea
				value={body}
				oninput={(event) => onBody(event.currentTarget.value)}></textarea></label
		>
		<pre class:error-text={Boolean(result?.error)} class="json-view">{resultText}</pre>
	</div>
</article>
