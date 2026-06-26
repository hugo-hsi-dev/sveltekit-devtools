import { exec } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { BuildAnalysis, BuildAssetInfo } from '../shared/types.js';
import { exists, slash, walkFiles } from './files.js';

interface BuildAnalyzeOptions {
	root: string;
	outputDir?: string;
	command?: string;
}

const outputLimit = 20_000;

export async function scanBuildOutput({
	root,
	outputDir = path.join(root, '.svelte-kit/output/client'),
}: BuildAnalyzeOptions): Promise<BuildAnalysis> {
	if (!(await exists(outputDir))) return idleBuildAnalysis();

	const files = await walkFiles(outputDir);
	const assets = await Promise.all(
		files.map(async (file) => {
			const found = await stat(file);
			return {
				path: slash(path.relative(root, file)),
				size: found.size,
				type: assetType(file),
				mtime: found.mtimeMs,
			} satisfies BuildAssetInfo;
		}),
	);
	const sorted = assets.sort((a, b) => b.size - a.size);
	const completedAt = Math.max(0, ...sorted.map((asset) => asset.mtime));

	return {
		status: 'success',
		startedAt: completedAt,
		completedAt,
		duration: 0,
		totalSize: sorted.reduce((sum, asset) => sum + asset.size, 0),
		assets: sorted,
		output: 'Existing SvelteKit build output',
	};
}

export async function runBuildAnalyze(options: BuildAnalyzeOptions): Promise<BuildAnalysis> {
	const startedAt = Date.now();
	const command = options.command ?? (await defaultBuildCommand(options.root));

	try {
		const output = await execCommand(command, options.root);
		const scanned = await scanBuildOutput(options);
		const completedAt = Date.now();
		return {
			...scanned,
			status: 'success',
			startedAt,
			completedAt,
			duration: completedAt - startedAt,
			output: trimOutput(output),
			command,
		};
	} catch (error) {
		const completedAt = Date.now();
		return {
			status: 'error',
			startedAt,
			completedAt,
			duration: completedAt - startedAt,
			totalSize: 0,
			assets: [],
			error: error instanceof Error ? error.message : String(error),
			command,
		};
	}
}

export function idleBuildAnalysis(): BuildAnalysis {
	return {
		status: 'idle',
		startedAt: 0,
		totalSize: 0,
		assets: [],
	};
}

async function defaultBuildCommand(root: string) {
	const pkg = await readPackageJson(root);
	const manager = pkg.packageManager ?? '';
	if (manager.startsWith('pnpm@')) return 'pnpm build';
	if (manager.startsWith('yarn@')) return 'yarn build';
	if (manager.startsWith('bun@')) return 'bun run build';
	return 'npm run build';
}

async function readPackageJson(root: string): Promise<{ packageManager?: string }> {
	try {
		return JSON.parse(await readFile(path.join(root, 'package.json'), 'utf-8')) as {
			packageManager?: string;
		};
	} catch {
		return {};
	}
}

function execCommand(command: string, cwd: string) {
	return new Promise<string>((resolve, reject) => {
		exec(
			command,
			{
				cwd,
				timeout: 120_000,
				maxBuffer: 1024 * 1024,
			},
			(error, stdout, stderr) => {
				const output = `${stdout}${stderr}`;
				if (error) {
					reject(new Error(trimOutput(output || error.message)));
					return;
				}
				resolve(output);
			},
		);
	});
}

function assetType(file: string): BuildAssetInfo['type'] {
	const extension = path.extname(file).toLowerCase();
	if (extension === '.js') return 'js';
	if (extension === '.css') return 'css';
	if (extension === '.html') return 'html';
	if (
		['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.woff', '.woff2'].includes(
			extension,
		)
	) {
		return 'asset';
	}
	return 'other';
}

function trimOutput(output: string) {
	return output.length > outputLimit ? output.slice(-outputLimit) : output;
}
