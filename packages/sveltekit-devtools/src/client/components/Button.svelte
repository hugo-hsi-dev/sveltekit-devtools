<script lang="ts">
	export let type: 'button' | 'submit' = 'button';
	export let disabled = false;
	export let title = '';
</script>

<button {type} {disabled} {title} on:click>
	<slot />
</button>
