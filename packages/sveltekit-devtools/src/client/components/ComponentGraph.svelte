<script lang="ts">
	import { onDestroy, tick } from 'svelte';

	import type { ComponentInfo } from '../../shared/types';
	import { componentGraphData } from '../component-graph';

	type NetworkInstance = import('vis-network/peer').Network;

	let {
		components = [],
		selectedFile = '',
		onSelect = () => {},
	}: {
		components?: ComponentInfo[];
		selectedFile?: string;
		onSelect?: (file: string) => void;
	} = $props();

	let container = $state<HTMLDivElement>();
	let network: NetworkInstance | null = null;
	let lastKey = '';
	let renderToken = 0;
	let destroyed = false;

	let graph = $derived(componentGraphData(components));
	$effect(() => {
		const key = JSON.stringify([graph.nodes, graph.edges, selectedFile]);
		if (!destroyed && container && key !== lastKey) {
			lastKey = key;
			void renderGraph(++renderToken);
		}
	});

	onDestroy(() => {
		destroyed = true;
		renderToken += 1;
		network?.destroy();
		network = null;
	});

	async function renderGraph(token: number) {
		await tick();
		if (destroyed || token !== renderToken || !container) return;
		const [{ DataSet }, { Network }] = await Promise.all([
			import('vis-data/peer'),
			import('vis-network/peer'),
		]);
		if (destroyed || token !== renderToken || !container) return;
		network?.destroy();
		network = new Network(
			container,
			{
				nodes: new DataSet(
					graph.nodes.map((node) => ({
						...node,
						shape: node.group === 'route' ? 'box' : 'dot',
						color:
							node.group === 'route'
								? { background: '#ff8a00', border: '#ff3e00', highlight: '#ff3e00' }
								: { background: '#2dd4bf', border: '#14b8a6', highlight: '#14b8a6' },
						font: { color: '#f5f5f5', face: 'DM Sans' },
						borderWidth: node.file === selectedFile ? 3 : 1,
					})),
				),
				edges: new DataSet(
					graph.edges.map((edge) => ({
						...edge,
						arrows: 'to',
						color: { color: 'rgba(156, 163, 175, 0.45)', highlight: '#ff8a00' },
					})),
				),
			},
			{
				autoResize: true,
				height: '360px',
				interaction: { hover: true, navigationButtons: false },
				layout: { improvedLayout: true },
				physics: { stabilization: true, barnesHut: { springLength: 140 } },
			},
		);
		network.on('selectNode', (event) => {
			const file = String(event.nodes[0] ?? '');
			if (file) onSelect(file);
		});
	}
</script>

<div class="graph-canvas" bind:this={container}></div>
