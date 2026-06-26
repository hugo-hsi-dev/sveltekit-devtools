import { expect, test } from 'vitest';

import { assetExtensions, filterAssets } from '../src/client/asset-filters';
import type { AssetInfo } from '../src/shared/types';

const asset = (path: string, type = 'image/png'): AssetInfo => ({
	id: path,
	path,
	url: `/${path.split('/').pop()}`,
	size: 10,
	type,
	mtime: 1,
	preview: type.startsWith('image/') ? 'image' : 'text',
});

test('filters assets by query and extension', () => {
	const assets = [asset('static/logo.png'), asset('static/robots.txt', 'text/plain')];

	expect(assetExtensions(assets)).toEqual(['.png', '.txt']);
	expect(filterAssets(assets, { extension: '.png' }).map((item) => item.path)).toEqual([
		'static/logo.png',
	]);
	expect(filterAssets(assets, { query: 'robots' }).map((item) => item.path)).toEqual([
		'static/robots.txt',
	]);
});
