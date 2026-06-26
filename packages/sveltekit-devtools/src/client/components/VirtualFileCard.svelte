<script lang="ts">
	import type { VirtualFileInfo } from '../../shared/types';
	import Badge from './Badge.svelte';

	export let file: VirtualFileInfo;
	export let onOpen: (file: string) => void = () => {};

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<article class="load-card">
	<div class="load-summary virtual-file-summary">
		<div>
			<strong>{file.path}</strong>
			<div class="muted">{new Date(file.mtime).toLocaleString()}</div>
		</div>
		<div>
			<code>{file.kind}</code>
			<div class="bar">
				<span style={`width:${Math.min(100, Math.max(4, file.size / 400))}%`}></span>
			</div>
		</div>
		<div>
			<strong>{formatBytes(file.size)}</strong>
			<div class="muted">{file.truncated ? 'preview' : 'full'}</div>
		</div>
		<button type="button" on:click={() => onOpen(file.path)}>Open file</button>
	</div>
	<pre class="json-view">{file.text}{file.truncated ? '\n... truncated' : ''}</pre>
</article>
