export interface DevtoolsSettings {
	hiddenViews: string[];
	scale: '90' | '100' | '110';
	compact: boolean;
}

export const defaultDevtoolsSettings: DevtoolsSettings = {
	hiddenViews: [],
	scale: '100',
	compact: false,
};

const scales = new Set<DevtoolsSettings['scale']>(['90', '100', '110']);

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

	return {
		hiddenViews,
		scale,
		compact: Boolean(value?.compact),
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
