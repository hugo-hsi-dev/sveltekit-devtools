import { expect, test } from 'vitest';

import type { SeoMeta } from '../src/shared/types';
import { bestSeoDescription, bestSeoTitle, missingSeoTags } from '../src/client/seo';

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
});
