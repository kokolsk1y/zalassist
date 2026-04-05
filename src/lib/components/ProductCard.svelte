<script>
	import { Check, Plus, PackageOpen } from "lucide-svelte";

	let { product, onselect, onadd, onremove, inCart = false } = $props();

	let imgError = $state(false);

	function handleAdd(e) {
		e.stopPropagation();
		if (onadd) onadd(product);
	}

	function handleRemove(e) {
		e.stopPropagation();
		if (onremove) onremove(product.id);
	}

	function formatPrice(price) {
		if (!price) return "";
		return price.toLocaleString("ru-RU") + " ₽";
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex gap-3 bg-base-100 rounded-xl shadow-sm p-3 cursor-pointer active:scale-[0.98] transition-transform"
	onclick={() => onselect?.(product)}
	onkeydown={(e) => { if (e.key === "Enter") onselect?.(product); }}
	role="button"
	tabindex="0"
>
	<!-- Фото -->
	<div class="w-20 h-20 rounded-lg bg-base-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
		{#if product.photo && !imgError}
			<img
				src={product.photo}
				alt={product.name}
				class="w-full h-full object-contain"
				onerror={() => imgError = true}
				loading="lazy"
			/>
		{:else}
			<PackageOpen size={28} class="text-base-content/20" />
		{/if}
	</div>

	<!-- Информация -->
	<div class="flex-1 min-w-0 flex flex-col justify-between">
		<div>
			<p class="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
			<p class="text-[13px] text-base-content/50 font-mono mt-0.5">Арт. {product.article}</p>
		</div>

		<div class="flex items-end justify-between mt-1">
			<div>
				{#if product.price}
					<div class="flex items-baseline gap-2">
						<span class="text-lg font-bold text-base-content">{formatPrice(product.price)}</span>
						{#if product.oldPrice}
							<span class="text-xs text-base-content/40 line-through">{formatPrice(product.oldPrice)}</span>
						{/if}
					</div>
				{/if}
				{#if product.inStock}
					{#if product.quantity && product.quantity <= 5}
						<p class="text-[13px] text-warning flex items-center gap-1 font-medium">
							<Check size={16} />
							Осталось {product.quantity} {product.unit || "шт"}
						</p>
					{:else}
						<p class="text-[13px] text-success flex items-center gap-1">
							<Check size={16} />
							В наличии{#if product.quantity} {product.quantity} {product.unit || "шт"}{/if}
						</p>
					{/if}
				{:else}
					<p class="text-[13px] text-base-content/40">Под заказ</p>
				{/if}
			</div>

			{#if inCart}
				<button type="button" class="btn btn-success btn-circle min-h-[44px] min-w-[44px] flex-shrink-0" onclick={handleRemove}>
					<Check size={20} />
				</button>
			{:else}
				<button type="button" class="btn btn-primary btn-circle min-h-[44px] min-w-[44px] flex-shrink-0" onclick={handleAdd}>
					<Plus size={20} />
				</button>
			{/if}
		</div>
	</div>
</div>
