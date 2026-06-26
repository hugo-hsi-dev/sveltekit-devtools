<script lang="ts">
	export let type: 'button' | 'submit' = 'button';
	export let disabled = false;
	export let title = '';
</script>

<button {...$$restProps} {type} {disabled} {title} on:click>
	<slot />
</button>
