<script lang="ts">
	import type { RuntimeEnvVar } from '../../shared/types';
	import MetaRow from './MetaRow.svelte';

	let { item }: { item: RuntimeEnvVar } = $props();
</script>

<MetaRow label={item.name} value={`${item.value} ${item.exposed ? '' : '(internal)'}`} />
