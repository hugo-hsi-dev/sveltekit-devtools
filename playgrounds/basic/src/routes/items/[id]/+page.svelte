<script lang="ts">
	let { data } = $props();
</script>

<main>
	<h1>{data.item.name}</h1>
	<p>Server load route: {data.item.id}</p>
</main>

<style>
	main {
		padding: 42px 22px;
	}
</style>
