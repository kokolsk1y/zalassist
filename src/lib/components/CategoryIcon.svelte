<script>
	import { categoryIcon } from "$lib/data/category-icons.js";

	let { category, size = 24, withBg = false } = $props();
	let info = $derived(categoryIcon(category));
</script>

{#if info}
	{#if withBg}
		<span
			class="cat-icon-bg"
			style:width="{size + 12}px"
			style:height="{size + 12}px"
			style:--cat-color={info.color}
		>
			<img src={info.iconUrl} alt="" width={size} height={size} class="cat-icon" />
		</span>
	{:else}
		<img src={info.iconUrl} alt="" width={size} height={size} class="cat-icon" />
	{/if}
{/if}

<style>
	.cat-icon {
		display: block;
		object-fit: contain;
	}
	.cat-icon-bg {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		background: color-mix(in oklch, var(--cat-color) 12%, transparent);
		color: var(--cat-color);
		flex-shrink: 0;
	}
</style>
