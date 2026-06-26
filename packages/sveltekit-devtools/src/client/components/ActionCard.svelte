<script lang="ts">
	import type { RouteActionInfo } from '../../shared/types';
	import type { ActionResult } from '../shared/view-context';
	import Badge from './Badge.svelte';

	let {
		action,
		input = '{}',
		requestPath,
		result,
		onInput = () => {},
		onRun = () => {},
		onOpen = () => {},
	}: {
		action: RouteActionInfo;
		input?: string;
		requestPath: string;
		result?: ActionResult;
		onInput?: (value: string) => void;
		onRun?: () => void;
		onOpen?: (file: string) => void;
	} = $props();

	let resultText = $derived(
		result
			? (result.error ??
					JSON.stringify(
						{
							status: `${result.status || '-'} ${result.statusText}`,
							duration: `${result.duration} ms`,
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
			<h3>{action.name}</h3>
			<p class="muted">{action.file}</p>
		</div>
		<Badge tone={action.default ? 'hot' : 'default'}>{action.path}</Badge>
	</div>
	<button type="button" onclick={() => onOpen(action.file)}>Open file</button>
	<div class="tester">
		<label>
			<span class="muted">Form fields JSON</span>
			<textarea
				placeholder={'{"name":"Ada"}'}
				value={input}
				oninput={(event) => onInput(event.currentTarget.value)}></textarea>
		</label>
		<button type="button" onclick={onRun}>Submit {requestPath}</button>
		<pre class:error-text={Boolean(result?.error)} class="json-view">{resultText}</pre>
	</div>
</article>
