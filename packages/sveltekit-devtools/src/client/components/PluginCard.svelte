<script lang="ts">
	import type { VitePluginInfo } from '../../shared/types';
	import MetaRow from './MetaRow.svelte';

	let { plugin }: { plugin: VitePluginInfo } = $props();
</script>

<article class="result-card compact-card">
	<h3>{plugin.name}</h3>
	<div class="meta-list">
		<MetaRow label="Enforce" value={plugin.enforce} />
		<MetaRow label="Apply" value={plugin.apply} />
	</div>
</article>
