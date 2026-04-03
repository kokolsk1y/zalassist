<script>
	let { product, onselect, onadd, onremove, inCart = false } = $props();
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-3 gap-1">
		<p class="text-xs text-base-content/50 font-mono">{product.article}</p>
		<p class="text-sm font-semibold leading-tight">{product.name}</p>

		<div class="flex items-center justify-between mt-2">
			<div class="flex items-center gap-2">
				<span class="badge badge-sm badge-ghost">{product.brand}</span>
				{#if product.inStock}
					<span class="badge badge-sm badge-success">В наличии</span>
				{:else}
					<span class="badge badge-sm badge-ghost">Под заказ</span>
				{/if}
			</div>

			{#if inCart}
				<div
					class="w-12 h-12 rounded-full bg-success flex items-center justify-center text-white text-xl cursor-pointer select-none"
					role="button"
					tabindex="0"
					onclick={() => onremove(product.id)}
				>✓</div>
			{:else}
				<div
					class="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-2xl cursor-pointer select-none"
					role="button"
					tabindex="0"
					onclick={() => onadd(product)}
				>+</div>
			{/if}
		</div>
	</div>
</div>
