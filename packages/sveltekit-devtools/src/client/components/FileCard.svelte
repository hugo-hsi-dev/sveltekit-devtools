<script lang="ts">
	import Badge from './Badge.svelte';

	let {
		file,
		title,
		badge,
		warn = false,
		onOpen = () => {},
	}: {
		file: string;
		title: string;
		badge: string;
		warn?: boolean;
		onOpen?: (file: string) => void;
	} = $props();
</script>

<div class="file-card">
	<div class="card-head">
		<strong>{title}</strong>
		<Badge tone={warn ? 'warn' : 'default'}>{badge}</Badge>
	</div>
	<p><code>{file}</code></p>
	<button type="button" onclick={() => onOpen(file)}>Open file</button>
</div>
