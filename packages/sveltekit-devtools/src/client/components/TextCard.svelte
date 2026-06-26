<script lang="ts">
	export let title: string;
	export let value: string;
	export let error = false;
</script>

<article class="result-card">
	<h3>{title}</h3>
	<pre class:error-text={error} class="json-view">{value}</pre>
</article>
