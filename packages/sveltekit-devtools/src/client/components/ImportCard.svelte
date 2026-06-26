<script lang="ts">
	import type { ImportInfo } from '../../shared/types';
	import Badge from './Badge.svelte';
	import MetaRow from './MetaRow.svelte';

	export let item: ImportInfo;
</script>

<article class="result-card">
	<div class="section-head compact">
		<div>
			<h3>{item.specifier}</h3>
			<p class="muted">{item.importedBy.length} files</p>
		</div>
		<Badge>{item.kind}</Badge>
	</div>
	<div class="meta-list">
		{#each item.importedBy as file}
			<MetaRow label="Imported by" value={file} />
		{/each}
	</div>
</article>
