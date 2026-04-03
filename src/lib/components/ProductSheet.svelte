<script>
	import { ShoppingCart } from "lucide-svelte";

	let { product, onclose, onadd } = $props();
	let dialog;
	let startY = 0;

	$effect(() => {
		if (product && dialog) {
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
		if (diff > 80) onclose?.(); // свайп вниз > 80px → закрыть
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom" onclose={() => onclose?.()}>
	<div class="modal-box rounded-t-2xl max-h-[80vh]"
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}>
		<!-- Индикатор свайпа -->
		<div class="w-10 h-1 bg-base-300 rounded-full mx-auto mb-3"></div>
		{#if product}
			<!-- Артикул -->
			<p class="font-mono text-lg text-primary font-bold">{product.article}</p>

			<!-- Название -->
			<h3 class="text-xl font-bold mt-2 leading-tight">{product.name}</h3>

			<!-- Бренд + Категория -->
			<div class="flex flex-wrap gap-2 mt-3">
				<span class="badge badge-primary badge-outline">{product.brand}</span>
				<span class="badge badge-ghost">{product.category}</span>
				{#if product.subcategory}
					<span class="badge badge-ghost badge-sm">{product.subcategory}</span>
				{/if}
			</div>

			<!-- Наличие -->
			<div class="mt-3">
				{#if product.inStock}
					<span class="badge badge-success">В наличии</span>
				{:else}
					<span class="badge badge-warning">Под заказ</span>
				{/if}
			</div>

			<!-- Описание -->
			{#if product.description}
				<p class="text-sm text-base-content/70 mt-4">{product.description}</p>
			{/if}

			<!-- Характеристики -->
			{#if product.specs && Object.keys(product.specs).length > 0}
				<div class="mt-4">
					<h4 class="text-sm font-semibold mb-2">Характеристики</h4>
					<div class="overflow-x-auto">
						<table class="table table-sm table-zebra">
							<tbody>
								{#each Object.entries(product.specs) as [key, value]}
									<tr>
										<td class="text-base-content/60 font-medium">{key}</td>
										<td>{value}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Кнопка "В список" -->
			<button
				class="btn btn-primary btn-block mt-6 gap-2"
				onclick={() => { onadd?.(product); onclose?.(); }}
			>
				<ShoppingCart size={18} />
				В список для менеджера
			</button>

			<!-- Дисклеймер -->
			<p class="text-xs text-base-content/60 text-center mt-3">
				Наличие и цены уточняйте у консультанта
			</p>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
