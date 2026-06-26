<script lang="ts">
	export let tone: 'default' | 'hot' | 'warn' = 'default';
</script>

<span class:hot={tone === 'hot'} class:warn={tone === 'warn'} class="badge">
	<slot />
</span>
