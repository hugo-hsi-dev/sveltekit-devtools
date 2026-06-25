import { expect, test } from 'vitest';

import { scanModuleGraph } from '../src/node/module-graph';

type FakeModule = {
	url: string;
	id: string | null;
	file: string | null;
	type: 'js' | 'css' | 'asset';
	importedModules: Set<FakeModule>;
	importers: Set<FakeModule>;
	acceptedHmrDeps: Set<FakeModule>;
	acceptedHmrExports: Set<string> | null;
	isSelfAccepting?: boolean;
	transformResult: object | null;
	ssrTransformResult: object | null;
	lastHMRTimestamp: number;
};

test('scans vite module graph modules and edges', () => {
	const root = '/repo/app';
	const page = fakeModule({
		url: '/src/routes/+page.svelte',
		id: '/repo/app/src/routes/+page.svelte',
		file: '/repo/app/src/routes/+page.svelte',
	});
	const svelte = fakeModule({
		url: '/node_modules/.vite/deps/svelte.js',
		id: '/repo/app/node_modules/.vite/deps/svelte.js',
		file: '/repo/app/node_modules/.vite/deps/svelte.js',
	});
	const virtual = fakeModule({
		url: '/@id/__x00__virtual:sveltekit-devtools/runtime',
		id: '\0virtual:sveltekit-devtools/runtime',
		file: null,
	});
	const style = fakeModule({
		url: '/src/routes/+page.svelte?type=style',
		id: '/repo/app/src/routes/+page.svelte?type=style',
		file: '/repo/app/src/routes/+page.svelte',
		type: 'css',
	});

	page.importedModules.add(svelte);
	page.importedModules.add(virtual);
	page.acceptedHmrDeps.add(style);
	page.acceptedHmrExports = new Set(['default']);
	page.isSelfAccepting = true;
	svelte.importers.add(page);
	virtual.importers.add(page);
	style.importers.add(page);

	const graph = scanModuleGraph({
		root,
		moduleGraph: {
			urlToModuleMap: new Map([
				[page.url, page],
				[svelte.url, svelte],
				[virtual.url, virtual],
				[style.url, style],
			]),
		} as never,
	});

	expect(graph.totalModules).toBe(4);
	expect(graph.transformedModules).toBe(4);
	expect(graph.hmrBoundaries).toBe(1);
	expect(graph.modules.map((module) => [module.file, module.kind])).toContainEqual([
		'src/routes/+page.svelte',
		'source',
	]);
	expect(graph.modules.map((module) => [module.file, module.kind])).toContainEqual([
		'node_modules/.vite/deps/svelte.js',
		'dependency',
	]);
	expect(graph.modules.map((module) => [module.url, module.kind])).toContainEqual([
		virtual.url,
		'virtual',
	]);
	expect(
		graph.modules.find(
			(module) => module.file === 'src/routes/+page.svelte' && module.kind === 'source',
		),
	).toMatchObject({
		importedModules: [virtual.url, 'node_modules/.vite/deps/svelte.js'],
		acceptedHmrDeps: ['src/routes/+page.svelte'],
		acceptedHmrExports: ['default'],
		selfAccepting: true,
	});
});

function fakeModule(overrides: Partial<FakeModule>): FakeModule {
	return {
		url: '/src/demo.ts',
		id: '/repo/app/src/demo.ts',
		file: '/repo/app/src/demo.ts',
		type: 'js',
		importedModules: new Set(),
		importers: new Set(),
		acceptedHmrDeps: new Set(),
		acceptedHmrExports: null,
		isSelfAccepting: false,
		transformResult: {},
		ssrTransformResult: null,
		lastHMRTimestamp: 0,
		...overrides,
	};
}
