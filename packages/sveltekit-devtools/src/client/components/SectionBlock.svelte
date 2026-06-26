<script lang="ts">
	export let title = '';
	export let description = '';
</script>

<section class="remote-calls">
	<div class="section-head compact">
		<div>
			<h3>{title}</h3>
			{#if description}<p class="muted">{description}</p>{/if}
		</div>
		<slot name="meta" />
	</div>
	<slot />
</section>
