<script lang="ts">
	import type { RuntimeEnvVar } from '../../shared/types';
	import MetaRow from './MetaRow.svelte';

	export let item: RuntimeEnvVar;
</script>

<MetaRow label={item.name} value={`${item.value} ${item.exposed ? '' : '(internal)'}`} />
