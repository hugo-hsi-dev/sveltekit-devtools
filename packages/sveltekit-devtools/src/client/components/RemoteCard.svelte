<script lang="ts">
	import type { RemoteFunctionInfo } from '../../shared/types';
	import Badge from './Badge.svelte';
	import MetaRow from './MetaRow.svelte';

	let {
		remote,
		input = '',
		result = { status: 'idle', text: 'No result yet' },
		onInput = () => {},
		onRun = () => {},
		onOpen = () => {},
	}: {
		remote: RemoteFunctionInfo;
		input?: string;
		result?: { status: 'idle' | 'running' | 'success' | 'error'; text: string };
		onInput?: (value: string) => void;
		onRun?: () => void;
		onOpen?: (file: string) => void;
	} = $props();

	let canRun = $derived(remote.callable && result.status !== 'running');
</script>

<article class="result-card">
	<div class="section-head compact">
		<div>
			<h3>{remote.name}</h3>
			<p class="muted">{remote.file}</p>
		</div>
		<Badge tone={remote.kind === 'command' ? 'warn' : 'hot'}>{remote.kind}</Badge>
	</div>
	<button type="button" onclick={() => onOpen(remote.file)}>Open file</button>
	<div class="meta-list">
		<MetaRow label="Validator" value={remote.validator} />
		<MetaRow label="Export" value={remote.name} />
	</div>
	<div class="tester">
		<label>
			<span class="muted">JSON input</span>
			<textarea
				placeholder={'{"id":"42"}'}
				value={input}
				oninput={(event) => onInput(event.currentTarget.value)}></textarea>
		</label>
		<button type="button" disabled={!canRun} onclick={onRun}>
			{remote.callable
				? result.status === 'running'
					? 'Running'
					: 'Run'
				: 'Forms need a form element'}
		</button>
		{#if remote.kind === 'command'}<p class="muted">
				Command can mutate server state. Click only when intended.
			</p>{/if}
		<pre class:error-text={result.status === 'error'} class="json-view">{result.text}</pre>
	</div>
</article>
