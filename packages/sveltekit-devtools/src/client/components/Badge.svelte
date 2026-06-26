<script lang="ts">
	import type { Snippet } from 'svelte';

	let { tone = 'default', children }: { tone?: 'default' | 'hot' | 'warn'; children?: Snippet } =
		$props();
</script>

<span class:hot={tone === 'hot'} class:warn={tone === 'warn'} class="badge">
	{#if children}{@render children()}{/if}
</span>
