declare module '@vitejs/devtools-kit/client' {
	export function getDevToolsClientContext(): {
		rpc: {
			call<T = unknown>(name: string, payload?: unknown): Promise<T>;
		};
	} | null;
}
