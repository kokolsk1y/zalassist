<script>
	import { Plus, Check } from "lucide-svelte";

	let { product, onselect, onadd, onremove, inCart = false } = $props();
</script>

<div
	class="card bg-base-100 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
	onclick={() => onselect?.(product)}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && onselect?.(product)}
>
	<div class="card-body p-4 gap-1">
		<p class="text-xs text-base-content/50 font-mono">{product.article}</p>
		<h3 class="card-title text-sm leading-tight">{product.name}</h3>
		<div class="flex items-center gap-2 mt-1">
			<span class="badge badge-sm badge-ghost">{product.brand}</span>
			{#if product.inStock}
				<span class="badge badge-sm badge-success gap-1">В наличии</span>
			{:else}
				<span class="badge badge-sm badge-ghost">Под заказ</span>
			{/if}
		</div>
		<div class="card-actions justify-end mt-2">
			<button
				class="btn btn-sm btn-circle {inCart ? 'btn-success' : 'btn-primary'}"
				onclick={(e) => { e.stopPropagation(); inCart ? onremove?.(product.id) : onadd?.(product); }}
				aria-label={inCart ? "Убрать из списка" : "Добавить в список"}
			>
				{#if inCart}
					<Check size={16} />
				{:else}
					<Plus size={16} />
				{/if}
			</button>
		</div>
	</div>
</div>
