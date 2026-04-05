<script>
	import { ShoppingCart, Check, PackageOpen, X } from "lucide-svelte";

	let { product, onclose, onadd } = $props();
	let dialog;
	let startY = 0;
	let imgError = $state(false);

	$effect(() => {
		if (product && dialog) {
			imgError = false;
			dialog.showModal();
		} else if (!product && dialog) {
			dialog.close();
		}
	});

	function handleTouchStart(e) {
		startY = e.touches[0].clientY;
	}

	function handleTouchEnd(e) {
		const diff = e.changedTouches[0].clientY - startY;
		if (diff > 80) onclose?.();
	}

	function formatPrice(price) {
		if (!price) return "";
		return price.toLocaleString("ru-RU") + " ₽";
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom" onclose={() => onclose?.()}>
	<div class="modal-box rounded-t-2xl max-h-[85vh] p-0"
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}>
		<!-- Индикатор свайпа -->
		<div class="w-10 h-1 bg-base-300 rounded-full mx-auto mt-3 mb-2"></div>

		<!-- Кнопка закрыть -->
		<button class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px] absolute right-2 top-2 z-10" onclick={() => onclose?.()}>
			<X size={22} />
		</button>

		{#if product}
			<!-- Фото -->
			<div class="w-full h-56 bg-base-200 flex items-center justify-center overflow-hidden">
				{#if product.photo && !imgError}
					<img
						src={product.photo}
						alt={product.name}
						class="max-w-full max-h-full object-contain p-4"
						onerror={() => imgError = true}
					/>
				{:else}
					<PackageOpen size={64} class="text-base-content/15" />
				{/if}
			</div>

			<div class="p-5">
				<!-- Название -->
				<h3 class="text-lg font-bold leading-tight">{product.name}</h3>

				<!-- Артикул -->
				<p class="text-sm article-code mt-1">Арт. {product.article}</p>

				<!-- Цена -->
				{#if product.price}
					<div class="flex items-baseline gap-3 mt-4">
						<span class="text-2xl font-bold">{formatPrice(product.price)}</span>
						{#if product.oldPrice}
							<span class="text-base text-base-content/40 line-through">{formatPrice(product.oldPrice)}</span>
						{/if}
					</div>
				{/if}

				<!-- Наличие -->
				<div class="mt-3">
					{#if product.inStock}
						<p class="text-sm text-success flex items-center gap-1.5">
							<Check size={16} />
							В наличии{#if product.quantity} — {product.quantity} {product.unit || "шт"}{/if}
						</p>
					{:else}
						<p class="text-sm text-warning">Под заказ</p>
					{/if}
				</div>

				<!-- Бренд + Категория -->
				<div class="flex flex-wrap gap-2 mt-4">
					{#if product.brand}
						<span class="badge badge-primary badge-outline">{product.brand}</span>
					{/if}
					{#if product.category}
						<span class="badge badge-ghost">{product.category}</span>
					{/if}
				</div>

				<!-- Кнопка "В список" -->
				<button
					class="btn btn-primary btn-block mt-6 gap-2"
					onclick={() => { onadd?.(product); onclose?.(); }}
				>
					<ShoppingCart size={18} />
					В список для менеджера
				</button>

				<!-- Дисклеймер -->
				<p class="text-xs text-base-content/50 text-center mt-3 pb-2">
					Цены розничные. Ваша скидка — у менеджера
				</p>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
