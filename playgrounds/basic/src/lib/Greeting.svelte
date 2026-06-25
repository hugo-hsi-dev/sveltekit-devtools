<script lang="ts">
	let { name, count = 0 } = $props<{ name: string; count?: number }>();
</script>

<section class="greeting">
	<strong>Hello {name}</strong>
	<span>{count} load keys tracked</span>
</section>

<style>
	.greeting {
		display: grid;
		gap: 4px;
		border: 1px solid #fed7aa;
		border-radius: 8px;
		background: #fff7ed;
		padding: 14px;
	}

	span {
		color: #9a3412;
	}
</style>
