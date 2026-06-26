import type { SeoMeta, SeoTag } from '../shared/types';

export interface SeoRequirement {
	key: keyof SeoMeta;
	label: string;
	explanation: string;
	docsUrl: string;
}

export const requiredSeoTags: SeoRequirement[] = [
	{
		key: 'title',
		label: '<title>',
		explanation: 'Browser tab title and default search result title.',
		docsUrl: 'https://kit.svelte.dev/docs/load#page-data',
	},
	{
		key: 'description',
		label: 'meta[name="description"]',
		explanation: 'Short page summary used by search and link previews.',
		docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name',
	},
	{
		key: 'canonical',
		label: 'link[rel="canonical"]',
		explanation: 'Preferred URL for duplicate or parameterized pages.',
		docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel#canonical',
	},
	{
		key: 'ogTitle',
		label: 'meta[property="og:title"]',
		explanation: 'Title for Open Graph previews.',
		docsUrl: 'https://ogp.me/',
	},
	{
		key: 'ogDescription',
		label: 'meta[property="og:description"]',
		explanation: 'Description for Open Graph previews.',
		docsUrl: 'https://ogp.me/',
	},
	{
		key: 'ogImage',
		label: 'meta[property="og:image"]',
		explanation: 'Image for social link previews.',
		docsUrl: 'https://ogp.me/',
	},
	{
		key: 'twitterCard',
		label: 'meta[name="twitter:card"]',
		explanation: 'Twitter/X card type such as summary_large_image.',
		docsUrl: 'https://developer.x.com/en/docs/x-for-websites/cards/overview/markup',
	},
];

export function missingSeoTags(meta: SeoMeta) {
	return missingSeoItems(meta).map((item) => item.label);
}

export function missingSeoItems(meta: SeoMeta) {
	return requiredSeoTags.filter((item) => !meta[item.key]);
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

export function normalizeSeoTags(meta: SeoMeta): SeoTag[] {
	const tags = Array.isArray(meta.tags) ? meta.tags : [];
	if (tags.length) return tags.filter((tag) => tag.tag && tag.name && tag.value);

	return [
		{ tag: 'title', name: '<title>', value: meta.title },
		{ tag: 'meta', name: 'description', value: meta.description },
		{ tag: 'link', name: 'canonical', value: meta.canonical },
		{ tag: 'meta', name: 'og:title', value: meta.ogTitle },
		{ tag: 'meta', name: 'og:description', value: meta.ogDescription },
		{ tag: 'meta', name: 'og:image', value: meta.ogImage },
		{ tag: 'meta', name: 'og:url', value: meta.ogUrl },
		{ tag: 'meta', name: 'og:type', value: meta.ogType },
		{ tag: 'meta', name: 'twitter:card', value: meta.twitterCard },
		{ tag: 'meta', name: 'twitter:title', value: meta.twitterTitle },
		{ tag: 'meta', name: 'twitter:description', value: meta.twitterDescription },
		{ tag: 'meta', name: 'twitter:image', value: meta.twitterImage },
	].filter((tag) => tag.value);
}
