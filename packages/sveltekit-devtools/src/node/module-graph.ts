import path from 'node:path';

import type { ModuleGraph, ModuleNode } from 'vite';

import type { ModuleGraphInfo, ModuleGraphModuleInfo } from '../shared/types.js';
import { slash } from './files.js';

interface ScanModuleGraphOptions {
	root: string;
	moduleGraph?: Pick<ModuleGraph, 'urlToModuleMap'>;
	maxModules?: number;
}

export function scanModuleGraph({
	root,
	moduleGraph,
	maxModules = 300,
}: ScanModuleGraphOptions): ModuleGraphInfo {
	const modules = moduleGraph ? [...new Set(moduleGraph.urlToModuleMap.values())] : [];
	const infos = modules.map((module) => moduleInfo(root, module)).sort(sortModules);

	return {
		totalModules: modules.length,
		transformedModules: infos.filter((module) => module.transformed || module.ssrTransformed)
			.length,
		hmrBoundaries: infos.filter(
			(module) =>
				module.selfAccepting ||
				module.acceptedHmrDeps.length > 0 ||
				module.acceptedHmrExports.length > 0,
		).length,
		modules: infos.slice(0, maxModules),
	};
}

function moduleInfo(root: string, module: ModuleNode): ModuleGraphModuleInfo {
	const id = module.id ?? module.url;
	const file = displayFile(root, module.file);

	return {
		id,
		url: module.url,
		file,
		kind: moduleKind(module, file, id),
		type: module.type,
		importedModules: moduleLabels(root, module.importedModules),
		importers: moduleLabels(root, module.importers),
		acceptedHmrDeps: moduleLabels(root, module.acceptedHmrDeps),
		acceptedHmrExports: [...(module.acceptedHmrExports ?? [])].sort(),
		selfAccepting: module.isSelfAccepting === true,
		transformed: Boolean(module.transformResult),
		ssrTransformed: Boolean(module.ssrTransformResult),
		lastHMRTimestamp: module.lastHMRTimestamp,
	};
}

function moduleLabels(root: string, modules: Set<ModuleNode>) {
	return [...modules].map((module) => labelModule(root, module)).sort();
}

function labelModule(root: string, module: ModuleNode) {
	return displayFile(root, module.file) || module.url || module.id || '(unknown)';
}

function displayFile(root: string, file: string | null) {
	if (!file) return '';
	const relative = slash(path.relative(root, file));
	return relative.startsWith('..') ? slash(file) : relative;
}

function moduleKind(module: ModuleNode, file: string, id: string): ModuleGraphModuleInfo['kind'] {
	if (module.type === 'css') return 'style';
	if (module.type === 'asset') return 'asset';
	if (!file || id.startsWith('\0') || module.url.includes('__x00__')) return 'virtual';
	if (file.includes('node_modules/') || id.includes('/node_modules/')) return 'dependency';
	return 'source';
}

function sortModules(a: ModuleGraphModuleInfo, b: ModuleGraphModuleInfo) {
	return (
		b.importers.length - a.importers.length ||
		b.importedModules.length - a.importedModules.length ||
		a.url.localeCompare(b.url)
	);
}
