<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		detail = '',
		meta,
		children,
	}: { title: string; detail?: string; meta?: Snippet; children?: Snippet } = $props();
</script>

<section class="remote-calls">
	<div class="section-head compact">
		<div>
			<h3>{title}</h3>
			{#if detail}<p class="muted">{detail}</p>{/if}
		</div>
		{#if meta}{@render meta()}{/if}
	</div>
	{#if children}{@render children()}{/if}
</section>
