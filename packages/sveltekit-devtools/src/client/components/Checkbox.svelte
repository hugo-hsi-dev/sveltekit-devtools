<script lang="ts">
	export let checked = false;
	export let value = '';
</script>

<label class="check-row">
	<input type="checkbox" bind:checked {value} on:change />
	<span><slot /></span>
</label>
