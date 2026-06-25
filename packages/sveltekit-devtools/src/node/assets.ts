import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { AssetInfo } from '../shared/types.js';

interface ScanAssetsOptions {
	root: string;
	staticDir: string;
}

const imageExtensions = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.txt', '.xml']);

export async function scanAssets({ root, staticDir }: ScanAssetsOptions): Promise<AssetInfo[]> {
	if (!(await exists(staticDir))) return [];

	const files = await walk(staticDir);
	const assets = await Promise.all(
		files.map(async (file) => {
			const found = await stat(file);
			const relative = slash(path.relative(staticDir, file));
			const url = `/${relative}`;
			return {
				id: relative,
				path: slash(path.relative(root, file)),
				url,
				size: found.size,
				type: mimeType(file),
				mtime: found.mtimeMs,
				preview: previewKind(file),
			} satisfies AssetInfo;
		}),
	);

	return assets.sort((a, b) => a.path.localeCompare(b.path));
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

function previewKind(file: string): AssetInfo['preview'] {
	const extension = path.extname(file).toLowerCase();
	if (imageExtensions.has(extension)) return 'image';
	if (textExtensions.has(extension)) return 'text';
	return 'other';
}

function mimeType(file: string) {
	const extension = path.extname(file).toLowerCase();
	if (extension === '.avif') return 'image/avif';
	if (extension === '.css') return 'text/css';
	if (extension === '.gif') return 'image/gif';
	if (extension === '.html') return 'text/html';
	if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
	if (extension === '.js') return 'text/javascript';
	if (extension === '.json') return 'application/json';
	if (extension === '.png') return 'image/png';
	if (extension === '.svg') return 'image/svg+xml';
	if (extension === '.txt') return 'text/plain';
	if (extension === '.webp') return 'image/webp';
	if (extension === '.xml') return 'application/xml';
	return 'application/octet-stream';
}

function slash(value: string) {
	return value.replaceAll(path.sep, '/');
}
