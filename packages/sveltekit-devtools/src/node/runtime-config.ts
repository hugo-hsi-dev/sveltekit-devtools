import type { ResolvedConfig } from 'vite';

import type { RuntimeConfigInfo } from '../shared/types.js';

type RuntimeConfigInput = Pick<ResolvedConfig, 'mode' | 'base' | 'env' | 'envPrefix'>;

export function scanRuntimeConfig(config: RuntimeConfigInput): RuntimeConfigInfo {
	const prefixes = normalizeEnvPrefix(config.envPrefix);
	return {
		mode: config.mode,
		base: config.base,
		envPrefix: prefixes,
		env: Object.entries(config.env)
			.map(([name, value]) => ({
				name,
				value: String(value),
				exposed: true,
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
	};
}

function normalizeEnvPrefix(prefix: ResolvedConfig['envPrefix']) {
	return (Array.isArray(prefix) ? prefix : [prefix]).filter((value): value is string =>
		Boolean(value),
	);
}
