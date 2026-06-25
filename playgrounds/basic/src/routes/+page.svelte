<script lang="ts">
	import Greeting from '$lib/Greeting.svelte';
	import { double } from '$lib/math.remote';

	let { data } = $props();
	let remoteResult = $state('No remote call yet');

	async function runRemoteDouble() {
		const result = await double(21);
		remoteResult = JSON.stringify(result, null, 2);
	}
</script>

<svelte:head>
	<title>SvelteKit Devtools Playground</title>
	<meta
		name="description"
		content="Inspect routes, load data, remote functions, and components in SvelteKit."
	/>
	<link rel="canonical" href="http://127.0.0.1:5173/" />
	<meta property="og:title" content="SvelteKit Devtools Playground" />
	<meta
		property="og:description"
		content="A playground for testing SvelteKit Devtools features."
	/>
	<meta property="og:image" content="/sveltekit-devtools.svg" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main>
	<h1>SvelteKit Devtools Playground</h1>
	<p>Open Devtools to inspect routes and load data.</p>
	<Greeting name="SvelteKit" count={Object.keys(data.stats).length} />
	<pre>{JSON.stringify(data.stats, null, 2)}</pre>
	<button type="button" onclick={runRemoteDouble}>Run remote double</button>
	<pre>{remoteResult}</pre>
</main>

<style>
	main {
		padding: 42px 22px;
		max-width: 840px;
	}

	h1 {
		margin: 0 0 12px;
		font-size: 36px;
		letter-spacing: 0;
	}

	pre {
		border: 1px solid #d7dde6;
		border-radius: 8px;
		background: white;
		padding: 16px;
	}

	button {
		margin: 12px 0;
		border: 1px solid #ff6b35;
		border-radius: 8px;
		background: #ff6b35;
		color: white;
		padding: 10px 14px;
		font: inherit;
		cursor: pointer;
	}
</style>
