import { expect, test } from 'vitest';

import {
	defaultDevtoolsSettings,
	isCategoryVisible,
	isViewVisible,
	normalizeSettings,
	setHiddenCategory,
	setHiddenView,
	setPinnedView,
} from '../src/client/settings';

const views = ['routes', 'loads', 'settings'];
const categories = ['app', 'server', 'analyze'];

test('normalizes stored settings', () => {
	expect(
		normalizeSettings(
			{
				hiddenViews: ['routes', 'nope', 'routes'],
				hiddenCategories: ['server', 'bad', 'server'],
				pinnedViews: ['loads', 'bad', 'loads'],
				scale: '200' as '100',
				compact: true,
				sidebarExpanded: false,
				sidebarScrollable: false,
				assetsView: 'list',
				componentsView: 'graph',
			},
			views,
			categories,
		),
	).toEqual({
		hiddenViews: ['routes'],
		hiddenCategories: ['server'],
		pinnedViews: ['loads'],
		scale: defaultDevtoolsSettings.scale,
		compact: true,
		theme: defaultDevtoolsSettings.theme,
		editor: defaultDevtoolsSettings.editor,
		sidebarExpanded: false,
		sidebarScrollable: false,
		assetsView: 'list',
		componentsView: 'graph',
	});
});

test('toggles hidden views', () => {
	const hidden = setHiddenView(defaultDevtoolsSettings, 'loads', true, views);
	const visible = setHiddenView(hidden, 'loads', false, views);

	expect(isViewVisible(hidden, 'loads')).toBe(false);
	expect(visible.hiddenViews).toEqual([]);
});

test('toggles hidden categories and pinned views', () => {
	const hidden = setHiddenCategory(defaultDevtoolsSettings, 'server', true, views, categories);
	const shown = setHiddenCategory(hidden, 'server', false, views, categories);
	const pinned = setPinnedView(shown, 'routes', true, views, categories);
	const unpinned = setPinnedView(pinned, 'routes', false, views, categories);

	expect(isCategoryVisible(hidden, 'server')).toBe(false);
	expect(shown.hiddenCategories).toEqual([]);
	expect(pinned.pinnedViews).toEqual(['routes']);
	expect(unpinned.pinnedViews).toEqual([]);
});
