import type { DevtoolsState } from '../shared/types';

export type TimelineEvent = {
	id: string;
	kind: 'load' | 'remote' | 'hook';
	label: string;
	detail: string;
	status: 'success' | 'error';
	startedAt: number;
	duration: number;
};

export function timelineEvents(state: Pick<DevtoolsState, 'loads' | 'remoteCalls' | 'hookEvents'>) {
	return [
		...state.loads.map(
			(event): TimelineEvent => ({
				id: `load:${event.id}`,
				kind: 'load',
				label: event.route,
				detail: `${event.source} · ${event.url}`,
				status: event.status,
				startedAt: event.startedAt,
				duration: event.duration,
			}),
		),
		...state.remoteCalls.map(
			(event): TimelineEvent => ({
				id: `remote:${event.id}`,
				kind: 'remote',
				label: event.name,
				detail: event.importPath,
				status: event.status,
				startedAt: event.startedAt,
				duration: event.duration,
			}),
		),
		...state.hookEvents.map(
			(event): TimelineEvent => ({
				id: `hook:${event.id}`,
				kind: 'hook',
				label: event.name,
				detail: `${event.environment} · ${event.url}`,
				status: event.status,
				startedAt: event.startedAt,
				duration: event.duration,
			}),
		),
	].sort((a, b) => b.startedAt - a.startedAt);
}
