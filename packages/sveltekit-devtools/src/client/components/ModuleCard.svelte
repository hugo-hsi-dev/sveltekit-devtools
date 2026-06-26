<script lang="ts">
	import type { ModuleGraphInfo, ModuleGraphModuleInfo } from '../../shared/types';
	import Badge from './Badge.svelte';
	import TextCard from './TextCard.svelte';

	export let module: ModuleGraphModuleInfo;
	export let graph: ModuleGraphInfo;
	export let onOpen: (file: string) => void = () => {};

	$: maxEdges = Math.max(
		1,
		...graph.modules.map((item) => item.importers.length + item.importedModules.length),
	);
	$: edges = module.importers.length + module.importedModules.length;
	$: width = Math.max(4, Math.round((edges / maxEdges) * 100));
	$: title = module.file || module.url || module.id;
	$: hmr =
		[
			module.selfAccepting ? 'self accepting' : '',
			module.acceptedHmrDeps.length ? `deps: ${module.acceptedHmrDeps.join(', ')}` : '',
			module.acceptedHmrExports.length ? `exports: ${module.acceptedHmrExports.join(', ')}` : '',
			module.transformed ? 'client transformed' : '',
			module.ssrTransformed ? 'ssr transformed' : '',
			module.lastHMRTimestamp
				? `last HMR: ${new Date(module.lastHMRTimestamp).toLocaleString()}`
				: '',
		]
			.filter(Boolean)
			.join('\n') || 'none';
</script>

<article class="load-card">
	<div class="load-summary module-summary">
		<div>
			<strong>{title}</strong>
			<div class="muted">{module.url}</div>
		</div>
		<div>
			<code>{module.id}</code>
			<div class="bar"><span style={`width:${width}%`}></span></div>
		</div>
		<div>
			<strong>{module.importers.length} / {module.importedModules.length}</strong>
			<div class="muted">in / out</div>
		</div>
		<div class="module-actions">
			<Badge tone={module.kind === 'source' ? 'hot' : 'default'}>{module.kind}</Badge>
			{#if module.file}<button type="button" on:click={() => onOpen(module.file)}>Open file</button
				>{/if}
		</div>
	</div>
	<div class="detail-grid">
		<TextCard title="Imported by" value={module.importers.join('\n') || 'none'} />
		<TextCard title="Imports" value={module.importedModules.join('\n') || 'none'} />
		<TextCard title="HMR" value={hmr} />
	</div>
</article>
