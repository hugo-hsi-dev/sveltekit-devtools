<script lang="ts">
	import type { TaskRunEvent } from '../../shared/types';
	import Badge from './Badge.svelte';

	export let run: TaskRunEvent;
	$: text = run.error ?? run.output ?? '';
</script>

<article class="load-card">
	<div class="load-summary">
		<div>
			<strong>{run.name}</strong>
			<div class="muted">{new Date(run.startedAt).toLocaleTimeString()}</div>
		</div>
		<div>
			<code>{run.command}</code>
			<div class="bar">
				<span style={`width:${Math.min(100, Math.max(4, run.duration ?? 0))}%`}></span>
			</div>
		</div>
		<div>
			<strong>{run.duration ?? 0} ms</strong>
			<div class="muted">task</div>
		</div>
		<Badge tone={run.status === 'error' ? 'warn' : 'hot'}>{run.status}</Badge>
	</div>
	<pre class:error-text={run.status === 'error'} class="json-view">{text || '(no output)'}</pre>
</article>
