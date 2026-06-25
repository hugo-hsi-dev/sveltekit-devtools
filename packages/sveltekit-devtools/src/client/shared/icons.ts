// Phosphor (regular) icons for the devtools rail/header, imported as raw SVG.
// Each asset already uses `viewBox="0 0 256 256"` + `fill="currentColor"`, so it
// inherits the accent via CSS `color` and is sized by the rail/header CSS rules.
import overview from '@phosphor-icons/core/assets/regular/squares-four.svg?raw';
import routes from '@phosphor-icons/core/assets/regular/tree-structure.svg?raw';
import loads from '@phosphor-icons/core/assets/regular/download-simple.svg?raw';
import timeline from '@phosphor-icons/core/assets/regular/pulse.svg?raw';
import hooks from '@phosphor-icons/core/assets/regular/plug.svg?raw';
import imports from '@phosphor-icons/core/assets/regular/arrow-square-in.svg?raw';
import plugins from '@phosphor-icons/core/assets/regular/puzzle-piece.svg?raw';
import runtimeConfig from '@phosphor-icons/core/assets/regular/sliders-horizontal.svg?raw';
import buildAnalyze from '@phosphor-icons/core/assets/regular/chart-bar.svg?raw';
import inspect from '@phosphor-icons/core/assets/regular/graph.svg?raw';
import tasks from '@phosphor-icons/core/assets/regular/terminal-window.svg?raw';
import openGraph from '@phosphor-icons/core/assets/regular/share-network.svg?raw';
import remotes from '@phosphor-icons/core/assets/regular/function.svg?raw';
import serverRoutes from '@phosphor-icons/core/assets/regular/hard-drives.svg?raw';
import actions from '@phosphor-icons/core/assets/regular/lightning.svg?raw';
import assets from '@phosphor-icons/core/assets/regular/image-square.svg?raw';
import components from '@phosphor-icons/core/assets/regular/cube.svg?raw';
import virtualFiles from '@phosphor-icons/core/assets/regular/file-dashed.svg?raw';
import settings from '@phosphor-icons/core/assets/regular/gear.svg?raw';

// Keyed by view id (matches `viewIcons` in shared/view-context.ts).
export const icons: Record<string, string> = {
	overview,
	routes,
	loads,
	timeline,
	hooks,
	imports,
	plugins,
	'runtime-config': runtimeConfig,
	'build-analyze': buildAnalyze,
	inspect,
	tasks,
	'open-graph': openGraph,
	remotes,
	'server-routes': serverRoutes,
	actions,
	assets,
	components,
	'virtual-files': virtualFiles,
	settings,
};

// Svelte logo for the rail top (brand mark, not a Phosphor icon).
export const svelteLogo = `<svg viewBox="0 0 98 118" width="24" height="24" aria-hidden="true"><path d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.9-1.6 8.9.5 18 5.7 25.3 11 15.7 32.6 20.3 48.2 10.4l27.5-17.5c7.5-4.7 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.9 1.6-8.9-.4-18.1-5.7-25.4" fill="#ff3e00"/><path d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7L65.5 72c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 4-9.8 8.5-12.7l27.5-17.5c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.3-7.1-2.5-.6.2-1.2.4-1.7.7L32.4 46c-1.4.9-2.3 2.2-2.6 3.8-.3 1.6.1 3.3 1 4.6 1.6 2.3 4.4 3.3 7.1 2.5.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-4 9.8-8.5 12.7l-27.5 17.5c-1.7 1.1-3.6 1.9-5.6 2.5" fill="#fff"/></svg>`;
