import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export async function walkFiles(dir: string): Promise<string[]> {
	return walkFilesInner(dir, new Set<string>());
}

async function walkFilesInner(dir: string, seen: Set<string>): Promise<string[]> {
	const resolved = await realpath(dir);
	if (seen.has(resolved)) return [];
	seen.add(resolved);

	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkFilesInner(file, seen)));
			continue;
		}
		if (entry.isSymbolicLink()) {
			try {
				if ((await stat(file)).isDirectory()) {
					files.push(...(await walkFilesInner(file, seen)));
					continue;
				}
			} catch {
				continue;
			}
		}
		files.push(file);
	}

	return files;
}

export async function exists(file: string) {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
}

export async function fileExists(file: string) {
	try {
		return (await stat(file)).isFile();
	} catch {
		return false;
	}
}

export function isInside(parent: string, child: string) {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function slash(value: string) {
	return value.replaceAll(path.sep, '/');
}

export function viteFsPath(file: string) {
	const normalized = slash(file);
	return normalized.startsWith('/') ? `/@fs${normalized}` : `/@fs/${normalized}`;
}
