<script lang="ts">
	import type { VitePluginInfo } from '../../shared/types';
	import Badge from './Badge.svelte';
	import Panel from './Panel.svelte';
	import PluginCard from './PluginCard.svelte';

	export let plugins: VitePluginInfo[] = [];
	const groups: VitePluginInfo['enforce'][] = ['pre', 'normal', 'post'];
</script>

<div class="section-head">
	<div>
		<h2>Plugins</h2>
		<p class="muted">Vite plugins active in this SvelteKit dev server.</p>
	</div>
	<Badge>{plugins.length} plugins</Badge>
</div>

{#each groups as enforce}
	{@const group = plugins.filter((plugin) => plugin.enforce === enforce)}
	{#if group.length}
		<Panel title={enforce} detail={`${group.length} plugins`}>
			<div class="detail-grid">
				{#each group as plugin}
					<PluginCard {plugin} />
				{/each}
			</div>
		</Panel>
	{/if}
{/each}
