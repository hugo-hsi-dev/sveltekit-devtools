import type { ImportInfo } from '../shared/types';

export type ImportFilterKind = 'all' | ImportInfo['kind'];

export function filterImports(
	imports: ImportInfo[],
	options: { query?: string; kind?: ImportFilterKind } = {},
) {
	const query = options.query?.trim().toLowerCase() ?? '';
	const kind = options.kind ?? 'all';

	return imports.filter((item) => {
		const matchesKind = kind === 'all' || item.kind === kind;
		const haystack = [item.specifier, item.kind, ...item.importedBy].join(' ').toLowerCase();
		return matchesKind && (!query || haystack.includes(query));
	});
}

export function importKindCounts(imports: ImportInfo[]) {
	const counts: Record<ImportFilterKind, number> = {
		all: imports.length,
		sveltekit: 0,
		lib: 0,
		package: 0,
		relative: 0,
		asset: 0,
	};
	for (const item of imports) counts[item.kind] += 1;
	return counts;
}
