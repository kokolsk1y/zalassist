<script>
	import { Plus, Check } from "lucide-svelte";

	let { product, onselect, onadd, onremove, inCart = false } = $props();

	function handleToggleCart(event) {
		event.preventDefault();
		if (inCart) {
			if (onremove) onremove(product.id);
		} else {
			if (onadd) onadd(product);
		}
	}

	function handleCardTap() {
		if (onselect) onselect(product);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card bg-base-100 shadow-sm" onclick={handleCardTap}>
	<div class="card-body p-4 gap-1">
		<p class="text-xs text-base-content/50 font-mono">{product.article}</p>
		<h3 class="card-title text-sm leading-tight">{product.name}</h3>

		<div class="flex items-center justify-between mt-2">
			<div class="flex items-center gap-2">
				<span class="badge badge-sm badge-ghost">{product.brand}</span>
				{#if product.inStock}
					<span class="badge badge-sm badge-success">В наличии</span>
				{:else}
					<span class="badge badge-sm badge-ghost">Под заказ</span>
				{/if}
			</div>

			<!-- Кнопка корзины — использует <a> вместо <button> для надёжности на мобильном -->
			<a
				href="#add"
				role="button"
				class="btn btn-circle w-12 h-12 no-underline {inCart ? 'btn-success' : 'btn-primary'}"
				onclick={handleToggleCart}
			>
				{#if inCart}
					<Check size={22} />
				{:else}
					<Plus size={22} />
				{/if}
			</a>
		</div>
	</div>
</div>
