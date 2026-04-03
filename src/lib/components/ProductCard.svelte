<script>
	let { product, onselect, onadd, onremove, inCart = false } = $props();

	function handleAdd() {
		if (onadd) {
			onadd(product);
		}
	}

	function handleRemove() {
		if (onremove) {
			onremove(product.id);
		}
	}
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
				<button type="button" class="btn btn-success btn-circle w-12 h-12 text-xl" onclick={handleRemove}>✓</button>
			{:else}
				<button type="button" class="btn btn-primary btn-circle w-12 h-12 text-2xl" onclick={() => { window.alert('click works!'); handleAdd(); }}>+</button>
			{/if}
		</div>
	</div>
</div>
