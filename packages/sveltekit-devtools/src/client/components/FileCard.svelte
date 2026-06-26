<script lang="ts">
	import Badge from './Badge.svelte';

	export let file: string;
	export let title: string;
	export let badge: string;
	export let warn = false;
	export let onOpen: (file: string) => void = () => {};
</script>

<div class="file-card">
	<div class="card-head">
		<strong>{title}</strong>
		<Badge tone={warn ? 'warn' : 'default'}>{badge}</Badge>
	</div>
	<p><code>{file}</code></p>
	<button type="button" on:click={() => onOpen(file)}>Open file</button>
</div>
