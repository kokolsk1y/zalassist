<script>
	import { ShoppingCart, Share2, Check, Eye, X } from "lucide-svelte";
	import { shareText } from "$lib/utils/share.js";
	import * as haptics from "$lib/utils/haptics.js";

	// Action sheet — нижняя плашка с быстрыми действиями над товаром.
	// Открывается долгим нажатием на карточку. iOS-стиль (action sheet).

	let { product, inCart = false, onclose, onadd, onremove, onview } = $props();
	let dialog;
	let armed = $state(false); // Кнопки активны только когда armed=true (защита от ложного клика после long-press)

	$effect(() => {
		if (product && dialog) {
			dialog.showModal();
			armed = false;
			// Игнорируем первый клик после открытия — это «отпускание пальца» от long-press,
			// иначе сразу срабатывает первая кнопка под пальцем
			setTimeout(() => { armed = true; }, 350);
		} else if (!product && dialog) {
			dialog.close();
		}
	});

	async function handleShare() {
		if (!product) return;
		const text = `${product.article} — ${product.name}${product.price ? ` — ${product.price}₽` : ""}`;
		await shareText({
			title: product.name,
			text,
		});
		haptics.tap();
		onclose?.();
	}

	function handleAdd() {
		haptics.success();
		onadd?.(product);
		onclose?.();
	}

	function handleRemove() {
		haptics.tap();
		onremove?.(product.id);
		onclose?.();
	}

	function handleView() {
		haptics.tap();
		onview?.(product);
		onclose?.();
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom" onclose={() => onclose?.()}>
	<div class="modal-box rounded-t-2xl p-0 max-w-md mx-auto">
		<!-- индикатор свайпа -->
		<div class="w-10 h-1 bg-base-300 rounded-full mx-auto mt-3 mb-1"></div>

		{#if product}
			<div class="px-5 pt-3 pb-2">
				<p class="text-xs article-code">{product.article}</p>
				<p class="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
			</div>

			<div class="border-t border-base-200 mt-2"></div>

			<div class="action-list">
				<button class="action-item" onclick={handleView} disabled={!armed}>
					<Eye size={20} class="text-base-content/60" />
					<span>Подробнее</span>
				</button>

				{#if inCart}
					<button class="action-item text-error" onclick={handleRemove} disabled={!armed}>
						<X size={20} />
						<span>Убрать из подбора</span>
					</button>
				{:else}
					<button class="action-item text-primary" onclick={handleAdd} disabled={!armed}>
						<ShoppingCart size={20} />
						<span>Добавить в подбор</span>
					</button>
				{/if}

				<button class="action-item" onclick={handleShare} disabled={!armed}>
					<Share2 size={20} class="text-base-content/60" />
					<span>Поделиться</span>
				</button>
			</div>

			<div class="border-t border-base-200"></div>

			<button
				class="w-full py-4 text-base-content/60 font-medium safe-bottom"
				onclick={() => onclose?.()}
			>
				Отмена
			</button>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<style>
	.action-list { display: flex; flex-direction: column; }
	.action-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 20px;
		font-size: 16px;
		font-weight: 500;
		text-align: left;
		min-height: 56px;
		border: none;
		background: none;
		color: var(--color-base-content);
		cursor: pointer;
		transition: background 0.1s ease;
	}
	.action-item:active { background: var(--color-base-200); }
	.action-item + .action-item { border-top: 1px solid var(--color-base-200); }
</style>
