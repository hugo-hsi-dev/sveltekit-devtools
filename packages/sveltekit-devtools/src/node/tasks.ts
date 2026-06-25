import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { TaskRunEvent, TaskScriptInfo } from '../shared/types.js';

interface TaskOptions {
	root: string;
	name: string;
	timeoutMs?: number;
}

type PackageJson = {
	packageManager?: string;
	scripts?: Record<string, string>;
};

const outputLimit = 20_000;
const longRunningNames = /^(dev|start|serve|preview)$/i;
const longRunningCommand =
	/\b(vite|svelte-kit|rollup|webpack|astro|next|nuxt)\s+(dev|preview|serve|start)\b|\b--watch\b|\b-w\b/;

export async function scanTasks(root: string): Promise<TaskScriptInfo[]> {
	const scripts = (await readPackageJson(root)).scripts ?? {};

	return Object.entries(scripts).map(([name, command]) => {
		const blocked = longRunningNames.test(name) || longRunningCommand.test(command);
		return {
			name,
			command,
			runnable: !blocked,
			reason: blocked ? 'long-running script' : undefined,
		};
	});
}

export async function runTask({
	root,
	name,
	timeoutMs = 30_000,
}: TaskOptions): Promise<TaskRunEvent> {
	const startedAt = Date.now();
	const task = (await scanTasks(root)).find((item) => item.name === name);
	if (!task) return finished(startedAt, name, '', 'error', '', `Unknown script "${name}"`);
	if (!task.runnable) {
		return finished(
			startedAt,
			task.name,
			task.command,
			'error',
			'',
			task.reason ?? 'script disabled',
		);
	}

	const command = `${await packageRunner(root)} ${quoteArg(task.name)}`;
	try {
		const output = await execCommand(command, root, timeoutMs);
		return finished(startedAt, task.name, command, 'success', output);
	} catch (error) {
		return finished(startedAt, task.name, command, 'error', '', errorMessage(error));
	}
}

async function packageRunner(root: string) {
	const manager = (await findPackageManager(root)).split('@')[0];
	if (manager === 'pnpm') return 'pnpm run';
	if (manager === 'yarn') return 'yarn run';
	if (manager === 'bun') return 'bun run';
	return 'npm run';
}

async function findPackageManager(root: string) {
	let dir = root;
	while (dir !== path.dirname(dir)) {
		const pkg = await readPackageJson(dir);
		if (pkg.packageManager) return pkg.packageManager;
		dir = path.dirname(dir);
	}
	return '';
}

async function readPackageJson(root: string): Promise<PackageJson> {
	try {
		return JSON.parse(await readFile(path.join(root, 'package.json'), 'utf-8')) as PackageJson;
	} catch {
		return {};
	}
}

function execCommand(command: string, cwd: string, timeout: number) {
	return new Promise<string>((resolve, reject) => {
		exec(
			command,
			{
				cwd,
				timeout,
				maxBuffer: 1024 * 1024,
			},
			(error, stdout, stderr) => {
				const output = trimOutput(`${stdout}${stderr}`);
				if (error) {
					reject(new Error(output || error.message));
					return;
				}
				resolve(output);
			},
		);
	});
}

function finished(
	startedAt: number,
	name: string,
	command: string,
	status: TaskRunEvent['status'],
	output = '',
	error = '',
): TaskRunEvent {
	const completedAt = Date.now();
	return {
		id: `${startedAt}:${name}`,
		name,
		command,
		status,
		startedAt,
		completedAt,
		duration: completedAt - startedAt,
		output: output ? trimOutput(output) : undefined,
		error: error || undefined,
	};
}

function quoteArg(value: string) {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function trimOutput(output: string) {
	return output.length > outputLimit ? output.slice(-outputLimit) : output;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
