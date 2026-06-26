import type { AssetInfo } from '../shared/types';

export type AssetViewMode = 'grid' | 'list';

export function assetExtension(asset: Pick<AssetInfo, 'path' | 'url'>) {
	const value = asset.path || asset.url;
	const file = value.split('/').pop() ?? '';
	const index = file.lastIndexOf('.');
	return index > 0 ? file.slice(index).toLowerCase() : 'none';
}

export function assetExtensions(assets: AssetInfo[]) {
	return [...new Set(assets.map(assetExtension))].sort();
}

export function filterAssets(
	assets: AssetInfo[],
	options: { query?: string; extension?: string } = {},
) {
	const query = options.query?.trim().toLowerCase() ?? '';
	const extension = options.extension ?? 'all';

	return assets.filter((asset) => {
		const matchesExtension = extension === 'all' || assetExtension(asset) === extension;
		const haystack = [asset.path, asset.url, asset.type, asset.preview].join(' ').toLowerCase();
		return matchesExtension && (!query || haystack.includes(query));
	});
}
