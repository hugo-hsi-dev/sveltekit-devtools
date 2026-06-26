<script lang="ts">
	export let value = '';
	export let options: Array<{ value: string; label: string; count?: number }> = [];
</script>

<div class="select-tabs">
	{#each options as option}
		<button
			type="button"
			class:active={option.value === value}
			on:click={() => (value = option.value)}
		>
			{option.label}
			{#if option.count !== undefined}<small>{option.count}</small>{/if}
		</button>
	{/each}
</div>
