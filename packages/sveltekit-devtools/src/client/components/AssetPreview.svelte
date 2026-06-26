<script lang="ts">
	import type { AssetInfo } from '../../shared/types';

	export let asset: AssetInfo;
</script>

{#if asset.preview === 'image'}
	<div class="asset-preview"><img src={asset.url} alt="" loading="lazy" /></div>
{:else}
	<div class="asset-preview muted">{asset.preview}</div>
{/if}
