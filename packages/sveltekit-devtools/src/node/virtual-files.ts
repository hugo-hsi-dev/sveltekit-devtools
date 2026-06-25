import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { VirtualFileInfo } from '../shared/types.js';

interface ScanVirtualFilesOptions {
	root: string;
	generatedDir?: string;
	maxTextLength?: number;
}

const defaultMaxTextLength = 20_000;

export async function scanVirtualFiles({
	root,
	generatedDir = path.join(root, '.svelte-kit/generated'),
	maxTextLength = defaultMaxTextLength,
}: ScanVirtualFilesOptions): Promise<VirtualFileInfo[]> {
	if (!(await exists(generatedDir))) return [];

	const files = await walk(generatedDir);
	const virtualFiles = await Promise.all(
		files.map(async (file) => {
			const found = await stat(file);
			const relative = slash(path.relative(root, file));
			const text = await readPreview(file, maxTextLength);
			return {
				id: relative,
				path: relative,
				size: found.size,
				mtime: found.mtimeMs,
				kind: virtualFileKind(path.relative(generatedDir, file)),
				text: text.value,
				truncated: text.truncated,
			} satisfies VirtualFileInfo;
		}),
	);

	return virtualFiles.sort((a, b) => a.path.localeCompare(b.path));
}

async function readPreview(file: string, maxTextLength: number) {
	const source = await readFile(file, 'utf-8');
	return {
		value: source.length > maxTextLength ? source.slice(0, maxTextLength) : source,
		truncated: source.length > maxTextLength,
	};
}

function virtualFileKind(relative: string): VirtualFileInfo['kind'] {
	const [first] = slash(relative).split('/');
	if (first === 'client-optimized') return 'client';
	if (first === 'client' || first === 'server' || first === 'shared') return first;
	if (first?.startsWith('root')) return 'root';
	return 'other';
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

function slash(value: string) {
	return value.replaceAll(path.sep, '/');
}
