<script>
	import { Plus, Check } from "lucide-svelte";

	let { product, onselect, onadd, onremove, inCart = false } = $props();
</script>

<div class="card bg-base-100 shadow-sm transition-transform">
	<div class="card-body p-4 gap-1">
		<!-- Кликабельная область для открытия деталей -->
		{#if onselect}
			<div
				class="cursor-pointer active:opacity-70"
				role="button"
				tabindex="0"
				onclick={() => onselect(product)}
				onkeydown={(e) => e.key === 'Enter' && onselect(product)}
			>
				<p class="text-xs text-base-content/50 font-mono">{product.article}</p>
				<h3 class="card-title text-sm leading-tight">{product.name}</h3>
			</div>
		{:else}
			<p class="text-xs text-base-content/50 font-mono">{product.article}</p>
			<h3 class="card-title text-sm leading-tight">{product.name}</h3>
		{/if}

		<div class="flex items-center gap-2 mt-1">
			<span class="badge badge-sm badge-ghost">{product.brand}</span>
			{#if product.inStock}
				<span class="badge badge-sm badge-success gap-1">В наличии</span>
			{:else}
				<span class="badge badge-sm badge-ghost">Под заказ</span>
			{/if}
		</div>

		<!-- Кнопка добавления — отдельная от карточки -->
		<div class="card-actions justify-end mt-2">
			<button
				class="btn btn-circle min-w-[48px] min-h-[48px] {inCart ? 'btn-success' : 'btn-primary'}"
				style="touch-action: manipulation"
				onclick={() => inCart ? onremove?.(product.id) : onadd?.(product)}
				aria-label={inCart ? "Убрать из списка" : "Добавить в список"}
			>
				{#if inCart}
					<Check size={22} />
				{:else}
					<Plus size={22} />
				{/if}
			</button>
		</div>
	</div>
</div>
