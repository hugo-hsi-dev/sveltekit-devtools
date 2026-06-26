<script lang="ts">
	let { title, value, error = false }: { title: string; value: string; error?: boolean } = $props();
</script>

<article class="result-card">
	<h3>{title}</h3>
	<pre class:error-text={error} class="json-view">{value}</pre>
</article>
