export interface DevtoolsSettings {
	hiddenViews: string[];
	hiddenCategories: string[];
	pinnedViews: string[];
	scale: '90' | '100' | '110';
	compact: boolean;
	theme: 'auto' | 'dark' | 'light';
	editor: string;
	sidebarExpanded: boolean;
	sidebarScrollable: boolean;
	assetsView: 'grid' | 'list';
	componentsView: 'list' | 'graph';
}

export const defaultDevtoolsSettings: DevtoolsSettings = {
	hiddenViews: [],
	hiddenCategories: [],
	pinnedViews: [],
	scale: '100',
	compact: false,
	theme: 'auto',
	editor: '',
	sidebarExpanded: true,
	sidebarScrollable: true,
	assetsView: 'grid',
	componentsView: 'list',
};

const scales = new Set<DevtoolsSettings['scale']>(['90', '100', '110']);
const themes = new Set<DevtoolsSettings['theme']>(['auto', 'dark', 'light']);
const assetViews = new Set<DevtoolsSettings['assetsView']>(['grid', 'list']);
const componentViews = new Set<DevtoolsSettings['componentsView']>(['list', 'graph']);
const defaultCategories = ['app', 'server', 'analyze'];

export function normalizeSettings(
	value: Partial<DevtoolsSettings> | null | undefined,
	configurableViews: readonly string[],
	configurableCategories: readonly string[] = defaultCategories,
): DevtoolsSettings {
	const allowed = new Set(configurableViews);
	const allowedCategories = new Set(configurableCategories);
	const hiddenViews = Array.isArray(value?.hiddenViews)
		? [...new Set(value.hiddenViews)].filter((view) => allowed.has(view))
		: [];
	const hiddenCategories = Array.isArray(value?.hiddenCategories)
		? [...new Set(value.hiddenCategories)].filter((category) => allowedCategories.has(category))
		: [];
	const pinnedViews = Array.isArray(value?.pinnedViews)
		? [...new Set(value.pinnedViews)].filter((view) => allowed.has(view))
		: [];
	const scale = scales.has(value?.scale as DevtoolsSettings['scale'])
		? (value?.scale as DevtoolsSettings['scale'])
		: defaultDevtoolsSettings.scale;

	const theme = themes.has(value?.theme as DevtoolsSettings['theme'])
		? (value?.theme as DevtoolsSettings['theme'])
		: defaultDevtoolsSettings.theme;

	return {
		hiddenViews,
		hiddenCategories,
		pinnedViews,
		scale,
		compact: typeof value?.compact === 'boolean' ? value.compact : defaultDevtoolsSettings.compact,
		theme,
		editor: typeof value?.editor === 'string' ? value.editor.slice(0, 64) : '',
		sidebarExpanded:
			typeof value?.sidebarExpanded === 'boolean'
				? value.sidebarExpanded
				: defaultDevtoolsSettings.sidebarExpanded,
		sidebarScrollable:
			typeof value?.sidebarScrollable === 'boolean'
				? value.sidebarScrollable
				: defaultDevtoolsSettings.sidebarScrollable,
		assetsView: assetViews.has(value?.assetsView as DevtoolsSettings['assetsView'])
			? (value?.assetsView as DevtoolsSettings['assetsView'])
			: defaultDevtoolsSettings.assetsView,
		componentsView: componentViews.has(value?.componentsView as DevtoolsSettings['componentsView'])
			? (value?.componentsView as DevtoolsSettings['componentsView'])
			: defaultDevtoolsSettings.componentsView,
	};
}

export function setHiddenView(
	settings: DevtoolsSettings,
	view: string,
	hidden: boolean,
	configurableViews: readonly string[],
) {
	return normalizeSettings(
		{
			...settings,
			hiddenViews: hidden
				? [...settings.hiddenViews, view]
				: settings.hiddenViews.filter((item) => item !== view),
		},
		configurableViews,
	);
}

export function setHiddenCategory(
	settings: DevtoolsSettings,
	category: string,
	hidden: boolean,
	configurableViews: readonly string[],
	configurableCategories: readonly string[] = defaultCategories,
) {
	return normalizeSettings(
		{
			...settings,
			hiddenCategories: hidden
				? [...settings.hiddenCategories, category]
				: settings.hiddenCategories.filter((item) => item !== category),
		},
		configurableViews,
		configurableCategories,
	);
}

export function setPinnedView(
	settings: DevtoolsSettings,
	view: string,
	pinned: boolean,
	configurableViews: readonly string[],
	configurableCategories: readonly string[] = defaultCategories,
) {
	return normalizeSettings(
		{
			...settings,
			pinnedViews: pinned
				? [...settings.pinnedViews, view]
				: settings.pinnedViews.filter((item) => item !== view),
		},
		configurableViews,
		configurableCategories,
	);
}

export function isViewVisible(settings: DevtoolsSettings, view: string) {
	return !settings.hiddenViews.includes(view);
}

export function isCategoryVisible(settings: DevtoolsSettings, category: string) {
	return !settings.hiddenCategories.includes(category);
}
