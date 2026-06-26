<script lang="ts">
	import type { ComponentInfo } from '../../shared/types';
	import Badge from './Badge.svelte';
	import MetaRow from './MetaRow.svelte';

	export let component: ComponentInfo;
	export let onOpen: (file: string) => void = () => {};

	$: blocks =
		[
			component.hasModuleScript ? 'module script' : '',
			component.hasInstanceScript ? 'instance script' : '',
			component.hasStyle ? 'style' : '',
		]
			.filter(Boolean)
			.join(', ') || 'markup only';
</script>

<article class="result-card">
	<div class="section-head compact">
		<div>
			<h3>{component.name}</h3>
			<p class="muted">{component.file}</p>
		</div>
		<Badge tone={component.kind === 'route' ? 'hot' : 'default'}>{component.kind}</Badge>
	</div>
	<button type="button" on:click={() => onOpen(component.file)}>Open file</button>
	<div class="meta-list">
		<MetaRow label="Route" value={component.route ?? '-'} />
		<MetaRow label="Props" value={component.props.join(', ') || 'none'} />
		<MetaRow label="Imports" value={component.imports.join(', ') || 'none'} />
		<MetaRow label="Used by" value={component.usedBy.join(', ') || 'none'} />
		<MetaRow label="Blocks" value={blocks} />
	</div>
</article>
