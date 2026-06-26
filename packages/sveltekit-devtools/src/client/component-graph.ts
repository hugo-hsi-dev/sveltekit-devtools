import type { ComponentInfo } from '../shared/types';
import { componentGraphEdges } from './route-components';

export interface ComponentGraphNode {
	id: string;
	label: string;
	group: 'route' | 'component';
	file: string;
	route?: string;
}

export interface ComponentGraphLink {
	id: string;
	from: string;
	to: string;
}

export interface ComponentGraphData {
	nodes: ComponentGraphNode[];
	edges: ComponentGraphLink[];
}

export function componentGraphData(components: ComponentInfo[]): ComponentGraphData {
	return {
		nodes: components
			.map((component) => ({
				id: component.file,
				label: component.route ? `${component.name}\n${component.route}` : component.name,
				group: component.kind,
				file: component.file,
				route: component.route,
			}))
			.sort((a, b) => a.group.localeCompare(b.group) || a.file.localeCompare(b.file)),
		edges: componentGraphEdges(components).map((edge) => ({
			id: `${edge.from.file}->${edge.to.file}`,
			from: edge.from.file,
			to: edge.to.file,
		})),
	};
}
