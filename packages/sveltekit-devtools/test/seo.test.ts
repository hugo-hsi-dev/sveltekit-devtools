import { expect, test } from 'vitest';

import type { SeoMeta } from '../src/shared/types';
import {
	bestSeoDescription,
	bestSeoTitle,
	missingSeoItems,
	missingSeoTags,
	normalizeSeoTags,
} from '../src/client/seo';

const emptyMeta: SeoMeta = {
	url: 'http://localhost:5173/',
	pathname: '/',
	title: '',
	description: '',
	canonical: '',
	ogTitle: '',
	ogDescription: '',
	ogImage: '',
	ogUrl: '',
	ogType: '',
	twitterCard: '',
	twitterTitle: '',
	twitterDescription: '',
	twitterImage: '',
	tags: [],
};

test('reports missing SEO tags and derives preview text', () => {
	const meta = {
		...emptyMeta,
		title: 'Page title',
		ogDescription: 'Social description',
	};

	expect(bestSeoTitle(meta)).toBe('Page title');
	expect(bestSeoDescription(meta)).toBe('Social description');
	expect(missingSeoTags(meta)).toEqual([
		'meta[name="description"]',
		'link[rel="canonical"]',
		'meta[property="og:title"]',
		'meta[property="og:image"]',
		'meta[name="twitter:card"]',
	]);
	expect(missingSeoItems(meta)[0]?.explanation).toContain('Short page summary');
	expect(normalizeSeoTags(meta).map((tag) => [tag.tag, tag.name, tag.value])).toEqual([
		['title', '<title>', 'Page title'],
		['meta', 'og:description', 'Social description'],
	]);
});
