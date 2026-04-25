<script>
	import { onMount } from "svelte";
	import { MapPin, PackageOpen } from "lucide-svelte";
	import { loadAisles, parseAisle, formatAisleLabel } from "$lib/data/aisles.js";

	let { aisle, displayed = null, compact = false } = $props();

	let departments = $state({});
	let parsed = $derived(parseAisle(aisle));
	let dept = $derived(parsed ? departments[parsed.dept] : null);

	onMount(async () => {
		const data = await loadAisles();
		departments = data.departments || {};
	});

	let label = $derived(formatAisleLabel(parsed, departments));
	let onShelf = $derived(displayed === true);
	let stockOnly = $derived(displayed === false);
</script>

{#if parsed}
	<div
		class="aisle-badge"
		class:compact
		class:on-shelf={onShelf}
		class:stock-only={stockOnly}
		style:--dept-color={dept?.color || "var(--color-primary)"}
	>
		{#if onShelf}
			<MapPin size={compact ? 14 : 16} />
		{:else if stockOnly}
			<PackageOpen size={compact ? 14 : 16} />
		{:else}
			<MapPin size={compact ? 14 : 16} />
		{/if}
		<span class="text">
			{#if stockOnly}
				На складе{#if !compact} — попросите консультанта{/if}
			{:else}
				{label}{#if onShelf && !compact} <span class="opacity-70">· выставлен</span>{/if}
			{/if}
		</span>
	</div>
{/if}

<style>
	.aisle-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 8px;
		background: color-mix(in oklch, var(--dept-color) 12%, transparent);
		color: var(--dept-color);
		font-size: 13px;
		font-weight: 500;
		line-height: 1.2;
		border: 1px solid color-mix(in oklch, var(--dept-color) 22%, transparent);
	}
	.aisle-badge.compact {
		padding: 3px 7px;
		font-size: 11px;
		gap: 4px;
		border-radius: 6px;
	}
	.aisle-badge.stock-only {
		background: color-mix(in oklch, var(--color-base-content) 6%, transparent);
		color: var(--color-base-content);
		border-color: color-mix(in oklch, var(--color-base-content) 15%, transparent);
	}
	.text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
