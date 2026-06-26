<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>SvelteKit Devtools Playground</title>
</svelte:head>

<nav>
	<a href="/">Dashboard</a>
	<a href="/about">About</a>
	<a href="/items/42">Item 42</a>
</nav>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: #f8fafc;
		color: #172033;
	}

	nav {
		display: flex;
		gap: 12px;
		padding: 16px 22px;
		border-bottom: 1px solid #d7dde6;
		background: white;
	}

	a {
		color: #c2410c;
		font-weight: 700;
		text-decoration: none;
	}
</style>
