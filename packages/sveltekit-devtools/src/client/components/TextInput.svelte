<script lang="ts">
	export let value = '';
	export let placeholder = '';
	export let type: 'text' | 'search' = 'text';
</script>

<input {type} bind:value {placeholder} autocomplete="off" on:input on:keydown />
