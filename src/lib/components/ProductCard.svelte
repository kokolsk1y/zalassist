<script>
	import { Plus, Check } from "lucide-svelte";

	let { product, onselect, onadd, onremove, inCart = false } = $props();

	function handleAdd(e) {
		e.preventDefault();
		e.stopPropagation();
		if (inCart) {
			onremove?.(product.id);
		} else {
			onadd?.(product);
		}
	}

	function handleCardClick() {
		onselect?.(product);
	}
</script>

<div
	class="card bg-base-100 shadow-sm active:scale-[0.98] transition-transform"
	role="button"
	tabindex="0"
	onclick={handleCardClick}
	onkeydown={(e) => e.key === 'Enter' && handleCardClick()}
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
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<button
				class="btn btn-circle {inCart ? 'btn-success' : 'btn-primary'} min-w-[44px] min-h-[44px]"
				style="touch-action: manipulation"
				onclick={handleAdd}
				aria-label={inCart ? "Убрать из списка" : "Добавить в список"}
			>
				{#if inCart}
					<Check size={20} />
				{:else}
					<Plus size={20} />
				{/if}
			</button>
		</div>
	</div>
</div>
