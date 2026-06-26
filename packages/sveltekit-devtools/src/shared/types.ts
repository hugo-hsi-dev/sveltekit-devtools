export type RouteFileKind = 'page' | 'layout' | 'error' | 'endpoint' | 'page-load' | 'layout-load';

export interface RouteFile {
	kind: RouteFileKind;
	name: string;
	path: string;
	server: boolean;
	layoutReset?: string;
}

export interface RouteOption {
	name: 'prerender' | 'ssr' | 'csr' | 'trailingSlash';
	value: string;
	file: string;
}

export interface RouteChainEntry extends RouteFile {
	route: string;
	inherited: boolean;
}

export interface SvelteKitRoute {
	id: string;
	path: string;
	files: RouteFile[];
	chain: RouteChainEntry[];
	options: RouteOption[];
	hasPage: boolean;
	hasLayout: boolean;
	hasError: boolean;
	hasEndpoint: boolean;
	hasLoad: boolean;
}

export interface SerializedValue {
	type: string;
	value: unknown;
	text: string;
	truncated: boolean;
}

export interface LoadFetchEvent {
	id: string;
	url: string;
	method: string;
	status: number;
	statusText: string;
	startedAt: number;
	duration: number;
	response?: SerializedValue;
	error?: string;
}

export interface LoadEvent {
	id: string;
	route: string;
	file: string;
	url: string;
	params?: Record<string, string>;
	query?: Record<string, string[]>;
	source: 'client' | 'server';
	status: 'success' | 'error';
	startedAt: number;
	duration: number;
	dataKeys: string[];
	data?: SerializedValue;
	eventData?: SerializedValue;
	fetches?: LoadFetchEvent[];
	error?: string;
}

export type HookEnvironment = 'server' | 'client' | 'universal';

export interface HookInfo {
	id: string;
	name: string;
	file: string;
	environment: HookEnvironment;
	instrumented: boolean;
}

export interface HookEvent {
	id: string;
	name: string;
	file: string;
	environment: HookEnvironment;
	status: 'success' | 'error';
	startedAt: number;
	duration: number;
	url: string;
	error?: string;
}

export interface ImportInfo {
	id: string;
	specifier: string;
	kind: 'sveltekit' | 'lib' | 'package' | 'relative' | 'asset';
	importedBy: string[];
}

export interface ComponentInfo {
	name: string;
	file: string;
	kind: 'route' | 'component';
	route?: string;
	props: string[];
	imports: string[];
	usedBy: string[];
	hasModuleScript: boolean;
	hasInstanceScript: boolean;
	hasStyle: boolean;
}

export type RemoteFunctionKind =
	| 'query'
	| 'query.batch'
	| 'query.live'
	| 'form'
	| 'command'
	| 'prerender';

export interface RemoteFunctionInfo {
	id: string;
	name: string;
	kind: RemoteFunctionKind;
	file: string;
	importPath: string;
	validator: 'none' | 'unchecked' | 'schema';
	callable: boolean;
}

export interface RemoteCallEvent {
	id: string;
	name: string;
	importPath: string;
	status: 'success' | 'error';
	startedAt: number;
	duration: number;
	input: string;
	output?: string;
	error?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface ServerRouteInfo {
	id: string;
	path: string;
	file: string;
	methods: HttpMethod[];
}

export interface RouteActionInfo {
	id: string;
	path: string;
	file: string;
	name: string;
	default: boolean;
}

export interface AssetInfo {
	id: string;
	path: string;
	url: string;
	size: number;
	type: string;
	mtime: number;
	preview: 'image' | 'text' | 'other';
}

export interface PackageDependencyInfo {
	name: string;
	version: string;
	type: 'dependency' | 'devDependency' | 'peerDependency';
}

export interface VitePluginInfo {
	name: string;
	enforce: 'pre' | 'post' | 'normal';
	apply: string;
}

export interface ModuleGraphModuleInfo {
	id: string;
	url: string;
	file: string;
	kind: 'source' | 'dependency' | 'virtual' | 'style' | 'asset';
	type: 'js' | 'css' | 'asset';
	importedModules: string[];
	importers: string[];
	acceptedHmrDeps: string[];
	acceptedHmrExports: string[];
	selfAccepting: boolean;
	transformed: boolean;
	ssrTransformed: boolean;
	lastHMRTimestamp: number;
}

export interface ModuleGraphInfo {
	totalModules: number;
	transformedModules: number;
	hmrBoundaries: number;
	modules: ModuleGraphModuleInfo[];
}

export interface ProjectInfo {
	name: string;
	version: string;
	packageManager: string;
	dependencies: PackageDependencyInfo[];
	vitePlugins: VitePluginInfo[];
}

export interface RuntimeEnvVar {
	name: string;
	value: string;
	exposed: boolean;
}

export interface RuntimeConfigInfo {
	mode: string;
	base: string;
	envPrefix: string[];
	env: RuntimeEnvVar[];
}

export interface BuildAssetInfo {
	path: string;
	size: number;
	type: 'js' | 'css' | 'html' | 'asset' | 'other';
	mtime: number;
}

export interface BuildAnalysis {
	status: 'idle' | 'running' | 'success' | 'error';
	startedAt: number;
	completedAt?: number;
	duration?: number;
	totalSize: number;
	assets: BuildAssetInfo[];
	output?: string;
	error?: string;
	command?: string;
}

export interface TaskScriptInfo {
	name: string;
	command: string;
	runnable: boolean;
	reason?: string;
}

export interface TaskRunEvent {
	id: string;
	name: string;
	command: string;
	status: 'running' | 'success' | 'error';
	startedAt: number;
	completedAt?: number;
	duration?: number;
	output?: string;
	error?: string;
}

export interface VirtualFileInfo {
	id: string;
	path: string;
	size: number;
	mtime: number;
	kind: 'client' | 'server' | 'shared' | 'root' | 'other';
	text: string;
	truncated: boolean;
}

export interface SeoTag {
	tag: string;
	name: string;
	value: string;
}

export interface SeoMeta {
	url: string;
	pathname: string;
	title: string;
	description: string;
	canonical: string;
	ogTitle: string;
	ogDescription: string;
	ogImage: string;
	ogUrl: string;
	ogType: string;
	twitterCard: string;
	twitterTitle: string;
	twitterDescription: string;
	twitterImage: string;
	tags: SeoTag[];
}

export interface DevtoolsState {
	root: string;
	project: ProjectInfo;
	runtimeConfig: RuntimeConfigInfo;
	buildAnalysis: BuildAnalysis;
	moduleGraph: ModuleGraphInfo;
	tasks: TaskScriptInfo[];
	taskRuns: TaskRunEvent[];
	routes: SvelteKitRoute[];
	loads: LoadEvent[];
	hooks: HookInfo[];
	hookEvents: HookEvent[];
	imports: ImportInfo[];
	components: ComponentInfo[];
	remotes: RemoteFunctionInfo[];
	remoteCalls: RemoteCallEvent[];
	serverRoutes: ServerRouteInfo[];
	routeActions: RouteActionInfo[];
	assets: AssetInfo[];
	virtualFiles: VirtualFileInfo[];
	generatedAt: number;
}
