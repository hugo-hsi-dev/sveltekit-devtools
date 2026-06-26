<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children?: Snippet } = $props();
</script>

<div class="loading" role="status" aria-live="polite">
	<span aria-hidden="true"></span>
	{#if children}{@render children()}{:else}Loading{/if}
</div>
