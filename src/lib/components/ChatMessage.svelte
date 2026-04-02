<script>
	import ProductCard from "./ProductCard.svelte";

	let { message, onadd, onaddall, cartIds = new Set() } = $props();
</script>

<div class="chat {message.role === 'user' ? 'chat-end' : 'chat-start'}">
	<div class="chat-bubble {message.role === 'user' ? 'chat-bubble-primary' : ''} whitespace-pre-wrap">
		{message.content}
		{#if message.streaming}
			<span class="loading loading-dots loading-xs ml-1"></span>
		{/if}
	</div>
</div>

{#if message.products?.length > 0}
	<div class="px-2 py-2 space-y-2">
		{#each message.products as product (product.id)}
			<ProductCard
				{product}
				inCart={cartIds.has(product.id)}
				onadd={() => onadd?.(product)}
			/>
		{/each}
		<button
			class="btn btn-sm btn-secondary w-full gap-1"
			onclick={() => onaddall?.(message.products)}
		>
			Добавить всё в список ({message.products.length})
		</button>
	</div>
{/if}
