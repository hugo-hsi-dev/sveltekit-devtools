<script lang="ts">
	import type { LoadEvent, LoadFetchEvent, SerializedValue } from '../../shared/types';
	import Badge from './Badge.svelte';
	import TextCard from './TextCard.svelte';

	export let events: LoadEvent[] = [];
	export let empty = 'No load events found';

	$: max = Math.max(1, ...events.map((event) => event.duration));
	$: maxFetch = Math.max(
		1,
		...events.flatMap((event) => (event.fetches ?? []).map((fetch) => fetch.duration)),
	);

	function width(duration: number) {
		return Math.max(4, Math.round((duration / max) * 100));
	}

	function fetchWidth(duration: number) {
		return Math.max(4, Math.round((duration / maxFetch) * 100));
	}

	function serializedText(value: SerializedValue | undefined) {
		return `${value?.text ?? 'undefined'}${value?.truncated ? '\n... truncated' : ''}`;
	}

	function formatJsonObject(value: Record<string, unknown> | undefined) {
		if (!value || Object.keys(value).length === 0) return 'none';
		return JSON.stringify(value, null, 2);
	}

	function loadContext(event: LoadEvent) {
		return [
			`URL: ${event.url || event.route}`,
			`Params: ${formatJsonObject(event.params)}`,
			`Query: ${formatJsonObject(event.query)}`,
		].join('\n\n');
	}

	function fetchTone(fetch: LoadFetchEvent) {
		return fetch.error || fetch.status >= 400 ? 'warn' : 'hot';
	}
</script>

<div class="load-list">
	{#each events as event}
		<article class="load-card">
			<div class="load-summary">
				<div>
					<strong>{event.route}</strong>
					<div class="muted">{new Date(event.startedAt).toLocaleTimeString()}</div>
				</div>
				<div>
					<code>{event.file}</code>
					<div class="bar"><span style={`width:${width(event.duration)}%`}></span></div>
				</div>
				<div>
					<strong>{event.duration} ms</strong>
					<div class="muted">{event.source}</div>
				</div>
				<Badge tone={event.status === 'error' ? 'warn' : 'hot'}>
					{event.status === 'error'
						? (event.error ?? 'error')
						: `${event.dataKeys.length || 0} keys`}
				</Badge>
			</div>
			<div class="detail-grid">
				<TextCard title="Route context" value={loadContext(event)} />
				{#if event.status === 'success'}
					<TextCard title="Returned data" value={serializedText(event.data)} />
					<TextCard title="Parent data from event" value={serializedText(event.eventData)} />
				{:else if event.error}
					<TextCard title="Error" value={event.error} error />
				{/if}
			</div>
			{#if event.fetches?.length}
				<section class="remote-calls">
					<div class="section-head compact">
						<div>
							<h3>Fetches inside load</h3>
							<p class="muted">Requests made through event.fetch.</p>
						</div>
						<Badge>{event.fetches.length} requests</Badge>
					</div>
					<div class="load-list">
						{#each event.fetches as fetch}
							<article class="load-card">
								<div class="load-summary">
									<div>
										<strong>{fetch.method} {fetch.url}</strong>
										<div class="muted">{new Date(fetch.startedAt).toLocaleTimeString()}</div>
									</div>
									<div>
										<code>{fetch.statusText || 'fetch'}</code>
										<div class="bar">
											<span style={`width:${fetchWidth(fetch.duration)}%`}></span>
										</div>
									</div>
									<div>
										<strong>{fetch.duration} ms</strong>
										<div class="muted">fetch</div>
									</div>
									<Badge tone={fetchTone(fetch)}>{fetch.status || 'error'}</Badge>
								</div>
								{#if fetch.response || fetch.error}
									<div class="detail-grid">
										{#if fetch.response}<TextCard
												title="Response"
												value={serializedText(fetch.response)}
											/>{/if}
										{#if fetch.error}<TextCard title="Error" value={fetch.error} error />{/if}
									</div>
								{/if}
							</article>
						{/each}
					</div>
				</section>
			{/if}
		</article>
	{:else}
		<div class="empty">{empty}</div>
	{/each}
</div>
