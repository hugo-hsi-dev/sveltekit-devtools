import type { ComponentInfo } from '../shared/types';

export interface RouteComponentUsage {
	component: ComponentInfo;
	depth: number;
}

export interface ComponentGraphEdge {
	from: ComponentInfo;
	to: ComponentInfo;
}

export function routeComponentUsages(
	components: ComponentInfo[],
	route: string,
): RouteComponentUsage[] {
	const byFile = new Map(components.map((component) => [component.file, component]));
	const roots = components
		.filter((component) => component.route === route)
		.sort((a, b) => a.file.localeCompare(b.file));
	const seen = new Set<string>();
	const usages: RouteComponentUsage[] = [];

	function visit(component: ComponentInfo, depth: number) {
		if (seen.has(component.file)) return;
		seen.add(component.file);
		usages.push({ component, depth });

		for (const file of [...component.imports].sort()) {
			const child = byFile.get(file);
			if (child) visit(child, depth + 1);
		}
	}

	for (const component of roots) visit(component, 0);

	return usages;
}

export function componentGraphEdges(components: ComponentInfo[]): ComponentGraphEdge[] {
	const byFile = new Map(components.map((component) => [component.file, component]));
	const edges: ComponentGraphEdge[] = [];

	for (const component of [...components].sort(componentSort)) {
		for (const file of [...component.imports].sort()) {
			const imported = byFile.get(file);
			if (imported) edges.push({ from: component, to: imported });
		}
	}

	return edges;
}

function componentSort(a: ComponentInfo, b: ComponentInfo) {
	if (a.kind !== b.kind) return a.kind === 'route' ? -1 : 1;
	return a.file.localeCompare(b.file);
}
