import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function walkFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const file = path.join(dir, entry.name);
			return entry.isDirectory() ? walkFiles(file) : [file];
		}),
	);
	return nested.flat();
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
