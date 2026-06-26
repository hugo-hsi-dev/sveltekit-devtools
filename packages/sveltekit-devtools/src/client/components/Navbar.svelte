<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children?: Snippet } = $props();
</script>

<nav class="sidebar" aria-label="Views">
	{#if children}{@render children()}{/if}
</nav>
