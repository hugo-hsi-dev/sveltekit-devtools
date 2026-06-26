<script lang="ts">
	export let title: string;
	export let detail = '';
</script>

<section class="remote-calls">
	<div class="section-head compact">
		<div>
			<h3>{title}</h3>
			{#if detail}<p class="muted">{detail}</p>{/if}
		</div>
		<slot name="meta" />
	</div>
	<slot />
</section>
