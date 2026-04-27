<script>
	import { Check, Plus, PackageOpen, Flame } from "lucide-svelte";
	import * as haptics from "$lib/utils/haptics.js";

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
	<!-- Фото товара. Фон зафиксирован белым (даже в тёмной теме): фотографии
	     поставщиков почти всегда на белом фоне, иначе видны серые «полосы»
	     по бокам когда object-contain не заполняет весь квадрат. -->
	<div class="product-photo relative w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
		{#if product.photo && !imgError}
			<img
				src={product.photo}
				alt={product.name}
				class="w-full h-full object-contain p-1"
				onerror={() => imgError = true}
				loading="lazy"
			/>
		{:else}
			<PackageOpen size={28} class="text-base-content/20" />
		{/if}

		<!-- Бейдж скидки — диагональная угловая лента с пламенем при сильной скидке -->
		{#if discount > 0}
			<span class="discount-badge" class:hot={discount >= 20} aria-label="Скидка {discount}%">
				{#if discount >= 20}
					<Flame size={10} class="discount-flame" />
				{/if}
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

	.product-photo {
		background: #ffffff;
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--color-base-content) 8%, transparent);
	}

	/* Бейдж скидки — sticker-стиль с градиентом и лёгким наклоном */
	.discount-badge {
		position: absolute;
		top: 6px;
		left: -4px;
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 3px 8px 3px 7px;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.02em;
		color: white;
		background: linear-gradient(135deg, oklch(62% 0.18 25), oklch(56% 0.22 18));
		border-radius: 4px 8px 8px 4px;
		box-shadow: 0 4px 10px -3px rgba(220, 38, 38, 0.45);
		transform: rotate(-4deg);
		text-shadow: 0 1px 0 rgba(0,0,0,0.15);
	}
	.discount-badge.hot {
		background: linear-gradient(135deg, oklch(72% 0.20 50), oklch(62% 0.22 25));
		box-shadow: 0 4px 12px -2px rgba(255, 100, 30, 0.55);
	}
	:global(.discount-flame) {
		color: oklch(98% 0.05 80);
	}
</style>
