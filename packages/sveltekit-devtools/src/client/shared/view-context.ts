export type View =
	| 'overview'
	| 'routes'
	| 'loads'
	| 'timeline'
	| 'hooks'
	| 'imports'
	| 'plugins'
	| 'runtime-config'
	| 'build-analyze'
	| 'inspect'
	| 'tasks'
	| 'open-graph'
	| 'remotes'
	| 'server-routes'
	| 'actions'
	| 'assets'
	| 'components'
	| 'virtual-files'
	| 'settings';

export type RemoteRunState = 'idle' | 'running' | 'success' | 'error';

export type ServerRouteResult = {
	status: number;
	statusText: string;
	duration: number;
	headers: Record<string, string>;
	body: string;
	error?: string;
};

export type ActionResult = {
	status: number;
	statusText: string;
	duration: number;
	body: string;
	error?: string;
};

export type CommandItem = {
	id: string;
	label: string;
	group: string;
};

export const viewLabels: Record<View, string> = {
	overview: 'Overview',
	routes: 'Routes',
	loads: 'Load data',
	timeline: 'Timeline',
	hooks: 'Hooks',
	imports: 'Imports',
	plugins: 'Plugins',
	'runtime-config': 'Runtime config',
	'build-analyze': 'Build analyze',
	inspect: 'Inspect',
	tasks: 'Tasks',
	'open-graph': 'Open Graph',
	remotes: 'Remotes',
	'server-routes': 'Server routes',
	actions: 'Actions',
	assets: 'Assets',
	components: 'Components',
	'virtual-files': 'Virtual files',
	settings: 'Settings',
};

// view -> icon key (matches keys in shared/icons.ts)
export const viewIcons: Record<View, string> = {
	overview: 'overview',
	routes: 'routes',
	loads: 'loads',
	timeline: 'timeline',
	hooks: 'hooks',
	imports: 'imports',
	plugins: 'plugins',
	'runtime-config': 'runtime-config',
	'build-analyze': 'build-analyze',
	inspect: 'inspect',
	tasks: 'tasks',
	'open-graph': 'open-graph',
	remotes: 'remotes',
	'server-routes': 'server-routes',
	actions: 'actions',
	assets: 'assets',
	components: 'components',
	'virtual-files': 'virtual-files',
	settings: 'settings',
};

export interface NavCategory {
	id: 'app' | 'server' | 'analyze';
	label: string;
	views: View[];
}

export const navCategories: NavCategory[] = [
	{
		id: 'app',
		label: 'App',
		views: ['routes', 'loads', 'timeline', 'hooks', 'components', 'open-graph'],
	},
	{
		id: 'server',
		label: 'Server',
		views: ['server-routes', 'actions', 'remotes', 'runtime-config', 'tasks'],
	},
	{
		id: 'analyze',
		label: 'Analyze',
		views: ['imports', 'assets', 'virtual-files', 'plugins', 'inspect', 'build-analyze'],
	},
];

export const configurableCategories = navCategories.map((category) => category.id);

export const viewToCategory = Object.fromEntries(
	navCategories.flatMap((category) => category.views.map((view) => [view, category.id])),
) as Partial<Record<View, NavCategory['id']>>;

export const allViews: View[] = [
	'overview',
	'routes',
	'loads',
	'timeline',
	'hooks',
	'imports',
	'plugins',
	'runtime-config',
	'build-analyze',
	'inspect',
	'tasks',
	'open-graph',
	'remotes',
	'server-routes',
	'actions',
	'assets',
	'components',
	'virtual-files',
	'settings',
];

export const configurableViews = allViews.filter(
	(item) => item !== 'overview' && item !== 'settings',
);
