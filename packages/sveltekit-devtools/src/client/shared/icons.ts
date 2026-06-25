// Inline SVG icons for the devtools rail and generic semantic uses.
// 20x20 viewBox, 1.5px stroke, currentColor. Easy to extend — add new keys here.

const svg = (paths: string): string =>
	`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons: Record<string, string> = {
	overview: svg(
		'<rect x="2.5" y="2.5" width="6" height="6" rx="1"/><rect x="11.5" y="2.5" width="6" height="6" rx="1"/><rect x="2.5" y="11.5" width="6" height="6" rx="1"/><rect x="11.5" y="11.5" width="6" height="6" rx="1"/>',
	),
	routes: svg(
		'<rect x="7" y="2.5" width="6" height="4" rx="1"/><rect x="2" y="13.5" width="6" height="4" rx="1"/><rect x="12" y="13.5" width="6" height="4" rx="1"/><path d="M10 6.5v3M10 9.5H5v4M10 9.5h5v4"/>',
	),
	loads: svg('<path d="M10 2.5v9M6 8l4 4 4-4M3.5 16.5h13"/>'),
	timeline: svg('<path d="M2 10h3l2-6 3 12 2.5-7 1.5 3H18"/>'),
	hooks: svg('<path d="M7.5 2.5v4M12.5 2.5v4M6 6.5h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4zM10 13.5v4"/>'),
	imports: svg('<path d="M3 6.5 10 3l7 3.5M3 6.5 10 10l7-3.5M3 6.5v7L10 17l7-3.5v-7M10 10v7"/>'),
	plugins: svg(
		'<path d="M8 2.5h2.5a1.5 1.5 0 0 1 0 3H8v3H5a1.5 1.5 0 0 0 0 3h0v3.5h3.5v0a1.5 1.5 0 0 0 3 0h0V14.5H15a1.5 1.5 0 0 0 0-3v0H11.5V8.5H15v-3H11.5"/>',
	),
	'runtime-config': svg(
		'<path d="M3 5.5h6M13 5.5h4M3 14.5h4M11 14.5h6"/><circle cx="11" cy="5.5" r="2"/><circle cx="9" cy="14.5" r="2"/>',
	),
	'build-analyze': svg('<path d="M3 17V8M8 17V3M13 17v-6M17 17H2"/>'),
	inspect: svg('<circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5 17 17"/>'),
	tasks: svg(
		'<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><path d="M5.5 8l2.5 2-2.5 2M10 12.5h4"/>',
	),
	'open-graph': svg(
		'<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><circle cx="7" cy="8" r="1.5"/><path d="M3 14l4-3.5 3 2.5 3-3 4 4"/>',
	),
	remotes: svg(
		'<path d="M6 13.5a3 3 0 0 1-.5-6 4 4 0 0 1 7.7-1 3 3 0 0 1 .8 5.9"/><path d="M8 14l2 2 2-2M10 10v6"/>',
	),
	'server-routes': svg(
		'<rect x="2.5" y="3" width="15" height="5" rx="1"/><rect x="2.5" y="12" width="15" height="5" rx="1"/><path d="M5.5 5.5h.01M5.5 14.5h.01"/>',
	),
	actions: svg('<path d="M3 10 17 3l-4 14-3-6-7-1Z"/>'),
	assets: svg(
		'<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><circle cx="7" cy="8" r="1.5"/><path d="M3 14l4-3.5 3 2.5 3-3 4 4"/>',
	),
	components: svg('<path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6Z M3.5 6 10 9.5 16.5 6M10 9.5v8"/>'),
	'virtual-files': svg(
		'<path d="M5 2.5h6l4 4v11H5zM11 2.5V6.5h4"/><path d="M8.5 11l-1.5 1.5 1.5 1.5M11.5 11l1.5 1.5-1.5 1.5"/>',
	),
	settings: svg(
		'<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2M10 15.5v2M3.5 6.5l1.7 1M14.8 12.5l1.7 1M3.5 13.5l1.7-1M14.8 7.5l1.7-1"/>',
	),
	// Generic semantic icons for reuse.
	'open-file': svg('<path d="M3 4.5h5l1.5 2H17v9H3z"/>'),
	'external-link': svg('<path d="M8 4H4v12h12v-4M12 3h5v5M17 3l-7 7"/>'),
	play: svg('<path d="M6 4l9 6-9 6Z"/>'),
	refresh: svg(
		'<path d="M16 4.5v3.5h-3.5M4 15.5V12h3.5"/><path d="M4.5 8a6 6 0 0 1 10.5-2.5M15.5 12a6 6 0 0 1-10.5 2.5"/>',
	),
	check: svg('<path d="M4 10.5l4 4 8-9"/>'),
	warning: svg('<path d="M10 3 18 16H2Z M10 8v4M10 14.5h.01"/>'),
};

// Svelte logo for the rail top.
export const svelteLogo = `<svg viewBox="0 0 98 118" width="24" height="24" aria-hidden="true"><path d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.9-1.6 8.9.5 18 5.7 25.3 11 15.7 32.6 20.3 48.2 10.4l27.5-17.5c7.5-4.7 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.9 1.6-8.9-.4-18.1-5.7-25.4" fill="#ff3e00"/><path d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7L65.5 72c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 4-9.8 8.5-12.7l27.5-17.5c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.3-7.1-2.5-.6.2-1.2.4-1.7.7L32.4 46c-1.4.9-2.3 2.2-2.6 3.8-.3 1.6.1 3.3 1 4.6 1.6 2.3 4.4 3.3 7.1 2.5.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-4 9.8-8.5 12.7l-27.5 17.5c-1.7 1.1-3.6 1.9-5.6 2.5" fill="#fff"/></svg>`;
