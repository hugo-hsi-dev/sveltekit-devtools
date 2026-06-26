<script lang="ts">
	import { slide } from 'svelte/transition';

	export let open = false;
</script>

{#if open}
	<aside class="drawer" transition:slide>
		<slot />
	</aside>
{/if}
