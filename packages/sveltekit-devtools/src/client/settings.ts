export interface DevtoolsSettings {
	hiddenViews: string[];
	scale: '90' | '100' | '110';
	compact: boolean;
	theme: 'auto' | 'dark' | 'light';
	editor: string;
}

export const defaultDevtoolsSettings: DevtoolsSettings = {
	hiddenViews: [],
	scale: '100',
	compact: false,
	theme: 'auto',
	editor: '',
};

const scales = new Set<DevtoolsSettings['scale']>(['90', '100', '110']);
const themes = new Set<DevtoolsSettings['theme']>(['auto', 'dark', 'light']);

export function normalizeSettings(
	value: Partial<DevtoolsSettings> | null | undefined,
	configurableViews: readonly string[],
): DevtoolsSettings {
	const allowed = new Set(configurableViews);
	const hiddenViews = Array.isArray(value?.hiddenViews)
		? [...new Set(value.hiddenViews)].filter((view) => allowed.has(view))
		: [];
	const scale = scales.has(value?.scale as DevtoolsSettings['scale'])
		? (value?.scale as DevtoolsSettings['scale'])
		: defaultDevtoolsSettings.scale;

	const theme = themes.has(value?.theme as DevtoolsSettings['theme'])
		? (value?.theme as DevtoolsSettings['theme'])
		: defaultDevtoolsSettings.theme;

	return {
		hiddenViews,
		scale,
		compact: Boolean(value?.compact),
		theme,
		editor: typeof value?.editor === 'string' ? value.editor.slice(0, 64) : '',
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

export function isViewVisible(settings: DevtoolsSettings, view: string) {
	return !settings.hiddenViews.includes(view);
}
