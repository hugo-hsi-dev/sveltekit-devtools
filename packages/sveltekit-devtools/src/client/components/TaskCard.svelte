<script lang="ts">
	import type { TaskScriptInfo } from '../../shared/types';
	import Badge from './Badge.svelte';

	export let task: TaskScriptInfo;
	export let running = false;
	export let onRun: (task: TaskScriptInfo) => void = () => {};
</script>

<article class="result-card">
	<div class="section-head compact">
		<div>
			<h3>{task.name}</h3>
			<p class="muted">{task.command}</p>
		</div>
		<Badge tone={task.runnable ? 'hot' : 'warn'}>{task.runnable ? 'runnable' : 'disabled'}</Badge>
	</div>
	<button type="button" disabled={running || !task.runnable} on:click={() => onRun(task)}>
		{running ? 'Running' : 'Run'}
	</button>
	{#if task.reason}<p class="muted">{task.reason}</p>{/if}
</article>
