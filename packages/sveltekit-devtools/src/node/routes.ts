import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { RouteFile, RouteFileKind, SvelteKitRoute } from '../shared/types.js';

export interface ScanRoutesOptions {
	routesDir: string;
	root: string;
}

const routeFilePattern = /^\+(page|layout|error|server)(\.server)?\.(svelte|js|ts)$/;
const routeOptionPattern =
	/\bexport\s+const\s+(prerender|ssr|csr|trailingSlash)\s*(?::[^=]+)?=\s*([^;\n]+)/g;
const routeChainWrapperKinds = new Set<RouteFileKind>(['layout', 'layout-load', 'error']);
const routeChainLeafKinds = new Set<RouteFileKind>(['page', 'page-load', 'endpoint']);
const routeChainKindOrder = new Map<RouteFileKind, number>([
	['layout', 0],
	['layout-load', 1],
	['error', 2],
	['page', 3],
	['page-load', 4],
	['endpoint', 5],
]);

export async function scanRoutes({
	routesDir,
	root,
}: ScanRoutesOptions): Promise<SvelteKitRoute[]> {
	if (!(await exists(routesDir))) return [];

	const files = await walk(routesDir);
	const routes = new Map<string, SvelteKitRoute>();

	for (const file of files) {
		const meta = classifyRouteFile(path.basename(file));
		if (!meta) continue;

		const dir = path.dirname(file);
		const id = routeIdFromDir(dir, routesDir);
		const route = routes.get(id) ?? {
			id,
			path: routePathFromId(id),
			files: [],
			chain: [],
			options: [],
			hasPage: false,
			hasLayout: false,
			hasError: false,
			hasEndpoint: false,
			hasLoad: false,
		};

		route.files.push({
			kind: meta.kind,
			name: path.basename(file),
			path: slash(path.relative(root, file)),
			server: meta.server,
		});
		route.options.push(
			...extractRouteOptions(await readFile(file, 'utf-8'), slash(path.relative(root, file))),
		);
		route.hasPage ||= meta.kind === 'page';
		route.hasLayout ||= meta.kind === 'layout';
		route.hasError ||= meta.kind === 'error';
		route.hasEndpoint ||= meta.kind === 'endpoint';
		route.hasLoad ||= meta.kind === 'page-load' || meta.kind === 'layout-load';
		routes.set(id, route);
	}

	const sortedRoutes = [...routes.values()].map((route) => ({
		...route,
		files: route.files.sort((a, b) => a.name.localeCompare(b.name)),
		options: route.options.sort((a, b) => a.name.localeCompare(b.name)),
	}));
	const byId = new Map(sortedRoutes.map((route) => [route.id, route]));

	return sortedRoutes
		.map((route) => ({
			...route,
			chain: routeChain(route.id, byId),
		}))
		.sort((a, b) => a.path.localeCompare(b.path));
}

function extractRouteOptions(source: string, file: string) {
	return [...source.matchAll(routeOptionPattern)].map((match) => ({
		name: match[1] as SvelteKitRoute['options'][number]['name'],
		value: (match[2] ?? '').trim(),
		file,
	}));
}

export function classifyRouteFile(file: string): { kind: RouteFileKind; server: boolean } | null {
	const match = routeFilePattern.exec(file);
	if (!match) return null;

	const type = match[1];
	const server = Boolean(match[2]) || type === 'server';
	const extension = match[3];

	if (type !== 'page' && type !== 'layout' && type !== 'error' && type !== 'server') return null;
	if (extension !== 'svelte' && extension !== 'js' && extension !== 'ts') return null;
	if (type === 'error' && (server || extension !== 'svelte')) return null;

	if (type === 'error') return { kind: 'error', server: false };
	if (type === 'server') return { kind: 'endpoint', server: true };
	if (extension === 'svelte') return { kind: type, server: false };
	return { kind: `${type}-load` as RouteFileKind, server };
}

export function routeIdFromFile(file: string, routesDir: string) {
	return routeIdFromDir(path.dirname(cleanId(file)), routesDir);
}

export function routeIdFromDir(dir: string, routesDir: string) {
	const relative = slash(path.relative(routesDir, dir));
	return relative === '' ? '/' : `/${relative}`;
}

export function routePathFromId(id: string) {
	if (id === '/') return '/';

	const parts = id
		.slice(1)
		.split('/')
		.filter((part) => part && !isPathlessGroup(part));

	return `/${parts.map(normalizeSegment).filter(Boolean).join('/')}`;
}

export function isRouteLoadModule(file: string, routesDir: string) {
	const clean = cleanId(file);
	if (!isInside(routesDir, clean)) return false;
	const meta = classifyRouteFile(path.basename(clean));
	return meta?.kind === 'page-load' || meta?.kind === 'layout-load';
}

export function cleanId(file: string) {
	return file.split('?')[0] ?? file;
}

function normalizeSegment(segment: string) {
	return segment
		.replace(/\[\.\.\.([^\]=]+)(?:=[^\]]+)?\]/g, '*$1')
		.replace(/\[\[([^\]=]+)(?:=[^\]]+)?\]\]/g, ':$1?')
		.replace(/\[([^\]=]+)(?:=[^\]]+)?\]/g, ':$1');
}

function isPathlessGroup(segment: string) {
	return segment.startsWith('(') && segment.endsWith(')');
}

function routeChain(id: string, routes: Map<string, SvelteKitRoute>) {
	return routeAncestors(id).flatMap((ownerId) => {
		const route = routes.get(ownerId);
		if (!route) return [];

		const allowed =
			ownerId === id ? [routeChainWrapperKinds, routeChainLeafKinds] : [routeChainWrapperKinds];
		return route.files
			.filter((file) => allowed.some((kinds) => kinds.has(file.kind)))
			.sort(compareRouteFilesByChain)
			.map((file) => ({
				...file,
				route: route.path,
				inherited: ownerId !== id,
			}));
	});
}

function routeAncestors(id: string) {
	if (id === '/') return ['/'];
	const parts = id.slice(1).split('/').filter(Boolean);
	return ['/', ...parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}`)];
}

function compareRouteFilesByChain(a: RouteFile, b: RouteFile) {
	return (
		(routeChainKindOrder.get(a.kind) ?? 99) - (routeChainKindOrder.get(b.kind) ?? 99) ||
		a.name.localeCompare(b.name)
	);
}

async function walk(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const file = path.join(dir, entry.name);
			return entry.isDirectory() ? walk(file) : [file];
		}),
	);
	return nested.flat();
}

async function exists(file: string) {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
}

function isInside(parent: string, child: string) {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function slash(value: string) {
	return value.replaceAll(path.sep, '/');
}
