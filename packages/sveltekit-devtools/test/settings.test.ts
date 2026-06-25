import { expect, test } from 'vitest';

import {
	defaultDevtoolsSettings,
	isViewVisible,
	normalizeSettings,
	setHiddenView,
} from '../src/client/settings';

const views = ['routes', 'loads', 'settings'];

test('normalizes stored settings', () => {
	expect(
		normalizeSettings(
			{
				hiddenViews: ['routes', 'nope', 'routes'],
				scale: '200' as '100',
				compact: true,
			},
			views,
		),
	).toEqual({
		hiddenViews: ['routes'],
		scale: defaultDevtoolsSettings.scale,
		compact: true,
		theme: defaultDevtoolsSettings.theme,
		editor: defaultDevtoolsSettings.editor,
	});
});

test('toggles hidden views', () => {
	const hidden = setHiddenView(defaultDevtoolsSettings, 'loads', true, views);
	const visible = setHiddenView(hidden, 'loads', false, views);

	expect(isViewVisible(hidden, 'loads')).toBe(false);
	expect(visible.hiddenViews).toEqual([]);
});
