import type { SeoMeta } from '../shared/types';

const requiredTags: Array<[keyof SeoMeta, string]> = [
	['title', '<title>'],
	['description', 'meta[name="description"]'],
	['canonical', 'link[rel="canonical"]'],
	['ogTitle', 'meta[property="og:title"]'],
	['ogDescription', 'meta[property="og:description"]'],
	['ogImage', 'meta[property="og:image"]'],
	['twitterCard', 'meta[name="twitter:card"]'],
];

export function missingSeoTags(meta: SeoMeta) {
	return requiredTags.filter(([key]) => !meta[key]).map(([, label]) => label);
}

export function bestSeoTitle(meta: SeoMeta) {
	return meta.ogTitle || meta.twitterTitle || meta.title || 'Untitled page';
}

export function bestSeoDescription(meta: SeoMeta) {
	return meta.ogDescription || meta.twitterDescription || meta.description || '';
}

export function bestSeoImage(meta: SeoMeta) {
	return meta.ogImage || meta.twitterImage;
}
