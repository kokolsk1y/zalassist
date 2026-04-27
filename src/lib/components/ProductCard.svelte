<script>
	import { Check, Plus, PackageOpen } from "lucide-svelte";
	import * as haptics from "$lib/utils/haptics.js";
	import CategoryIcon from "./CategoryIcon.svelte";

	let { product, onselect, onadd, onremove, onlongpress, inCart = false } = $props();

	let imgError = $state(false);
	let justAdded = $state(false); // короткая зелёная вспышка после добавления

	// Long-press: pointerdown держим 500мс без движения → открываем action sheet
	let pressTimer = null;
	let pressX = 0;
	let pressY = 0;
	let longPressed = false;
	const LONG_PRESS_MS = 500;
	const MOVE_THRESHOLD = 8;

	function handlePointerDown(e) {
		if (!onlongpress) return;
		longPressed = false;
		pressX = e.clientX;
		pressY = e.clientY;
		pressTimer = setTimeout(() => {
			longPressed = true;
			haptics.longPress();
			onlongpress(product);
		}, LONG_PRESS_MS);
	}

	function handlePointerMove(e) {
		if (!pressTimer) return;
		if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > MOVE_THRESHOLD) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handlePointerUp() {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handleClick() {
		if (longPressed) {
			longPressed = false;
			return;
		}
		onselect?.(product);
	}

	function handleAdd(e) {
		e.stopPropagation();
		haptics.success();
		justAdded = true;
		setTimeout(() => { justAdded = false; }, 600);
		if (onadd) onadd(product);
	}

	function handleRemove(e) {
		e.stopPropagation();
		haptics.tap();
		if (onremove) onremove(product.id);
	}

	function formatPrice(price) {
		if (!price) return "";
		return price.toLocaleString("ru-RU") + " ₽";
	}

	// Цена за единицу — для кабеля «245 ₽/м», для розеток «450 ₽/шт»
	let priceUnit = $derived(product?.unit && product.unit !== "шт" ? `/${product.unit}` : "");
	let discount = $derived(
		product?.price && product?.oldPrice && product.oldPrice > product.price
			? Math.round((1 - product.price / product.oldPrice) * 100)
			: 0
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="card-root flex gap-3 bg-base-100 rounded-xl shadow-sm p-3 cursor-pointer active:scale-[0.98] transition-transform select-none"
	class:just-added={justAdded}
	onclick={handleClick}
	onkeydown={(e) => { if (e.key === "Enter") onselect?.(product); }}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
	oncontextmenu={(e) => { if (onlongpress) e.preventDefault(); }}
	role="button"
	tabindex="0"
>
	<!-- Фото с маленькой иконкой категории сверху-слева как «корешок» -->
	<div class="relative w-20 h-20 rounded-lg bg-base-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
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

		<!-- Маленькая иконка категории stv39 — поверх фото, верх-лево -->
		{#if product.category}
			<span class="absolute top-0.5 left-0.5">
				<CategoryIcon category={product.category} size={16} withBg={true} />
			</span>
		{/if}

		<!-- Бейдж скидки (если есть oldPrice) -->
		{#if discount > 0}
			<span class="absolute bottom-0 right-0 bg-error text-error-content text-[10px] font-bold px-1.5 py-0.5 rounded-tl-md">
				−{discount}%
			</span>
		{/if}
	</div>

	<!-- Информация -->
	<div class="flex-1 min-w-0 flex flex-col justify-between">
		<div>
			<p class="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
			<div class="flex items-center gap-2 mt-0.5 flex-wrap">
				<p class="text-[12px] article-code">{product.article}</p>
				{#if product.brand}
					<span class="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold">{product.brand}</span>
				{/if}
			</div>
		</div>

		<div class="flex items-end justify-between mt-1 gap-2">
			<div class="min-w-0 flex-1">
				{#if product.price}
					<div class="flex items-baseline gap-1.5 flex-wrap">
						<span class="text-lg font-bold text-base-content leading-none">{formatPrice(product.price)}<span class="text-xs font-medium text-base-content/60">{priceUnit}</span></span>
						{#if product.oldPrice && product.oldPrice > product.price}
							<span class="text-xs text-base-content/40 line-through">{formatPrice(product.oldPrice)}</span>
						{/if}
					</div>
				{/if}
				{#if product.inStock}
					{#if product.quantity && product.quantity <= 5}
						<p class="text-[12px] text-warning flex items-center gap-1 font-semibold mt-0.5">
							<Check size={14} />
							Осталось {product.quantity}
						</p>
					{:else}
						<p class="text-[12px] text-success flex items-center gap-1 mt-0.5">
							<Check size={14} />
							В наличии{#if product.quantity} · {product.quantity} {product.unit || "шт"}{/if}
						</p>
					{/if}
				{:else}
					<p class="text-[12px] flex items-center gap-1 mt-0.5">
						<span class="inline-block w-1.5 h-1.5 rounded-full bg-warning"></span>
						<span class="text-warning font-medium">Под заказ</span>
					</p>
				{/if}
			</div>

			{#if inCart}
				<button type="button" class="btn btn-success btn-circle min-h-[44px] min-w-[44px] flex-shrink-0" onclick={handleRemove} aria-label="Убрать из подбора">
					<Check size={20} />
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-primary btn-circle min-h-[44px] min-w-[44px] flex-shrink-0 add-btn"
					onclick={handleAdd}
					aria-label="Добавить в подбор"
				>
					<Plus size={20} />
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.card-root {
		transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.3s ease;
	}
	.card-root.just-added {
		background: color-mix(in oklch, var(--color-success) 12%, var(--color-base-100));
		animation: card-flash 0.6s ease-out;
	}
	@keyframes card-flash {
		0% { background: color-mix(in oklch, var(--color-success) 25%, var(--color-base-100)); }
		100% { background: var(--color-base-100); }
	}
	.add-btn {
		transition: transform 0.15s ease, background 0.15s ease;
	}
	.add-btn:active { transform: scale(0.88); }
</style>
