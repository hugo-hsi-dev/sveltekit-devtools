<script lang="ts">
	import type { HttpMethod, ServerRouteInfo } from '../../shared/types';
	import type { ServerRouteResult } from '../shared/view-context';
	import Badge from './Badge.svelte';

	export let route: ServerRouteInfo;
	export let method: HttpMethod = route.methods[0] ?? 'GET';
	export let path = route.path;
	export let headers = '{}';
	export let body = '';
	export let result: ServerRouteResult | undefined;
	export let onMethod: (value: HttpMethod) => void = () => {};
	export let onPath: (value: string) => void = () => {};
	export let onHeaders: (value: string) => void = () => {};
	export let onBody: (value: string) => void = () => {};
	export let onRun: () => void = () => {};
	export let onOpen: (file: string) => void = () => {};

	$: methods = route.methods.length ? route.methods : (['GET'] as HttpMethod[]);
	$: resultText = result
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
		: 'No response yet';
</script>

<article class="result-card">
	<div class="section-head compact">
		<div>
			<h3>{route.path}</h3>
			<p class="muted">{route.file}</p>
		</div>
		<Badge tone="hot">{route.methods.length ? route.methods.join(', ') : 'no methods'}</Badge>
	</div>
	<button type="button" on:click={() => onOpen(route.file)}>Open file</button>
	<div class="tester">
		<div class="request-row">
			<select
				value={method}
				on:change={(event) => onMethod(event.currentTarget.value as HttpMethod)}
			>
				{#each methods as item}<option value={item}>{item}</option>{/each}
			</select>
			<input
				value={path}
				aria-label="Request path"
				on:input={(event) => onPath(event.currentTarget.value)}
			/>
			<button type="button" on:click={onRun}>Send</button>
		</div>
		<label
			><span class="muted">Headers JSON</span><textarea
				value={headers}
				on:input={(event) => onHeaders(event.currentTarget.value)}></textarea></label
		>
		<label
			><span class="muted">Body</span><textarea
				value={body}
				on:input={(event) => onBody(event.currentTarget.value)}></textarea></label
		>
		<pre class:error-text={Boolean(result?.error)} class="json-view">{resultText}</pre>
	</div>
</article>
