<script lang="ts">
	import type { LoadEvent } from '../../shared/types';
	import Badge from './Badge.svelte';
	import LoadRows from './LoadRows.svelte';

	let { title, events = [] }: { title: string; events?: LoadEvent[] } = $props();
</script>

<section class="remote-calls">
	<div class="section-head compact">
		<div>
			<h3>{title}</h3>
			<p class="muted">Keeps query variants and returned data together.</p>
		</div>
		<Badge>{events.length} calls</Badge>
	</div>
	<LoadRows {events} />
</section>
