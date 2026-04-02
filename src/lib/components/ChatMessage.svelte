<script>
	import { Package, Plus, Check, ChevronDown, ChevronUp } from "lucide-svelte";

	let { message, onadd, onremove, onaddall, onselect, cartIds = new Set() } = $props();
	let expanded = $state(false);
	let visible = $state(false);

	// Плавное появление карточек после ответа ИИ
	$effect(() => {
		if (message.products?.length > 0 && !message.streaming) {
			setTimeout(() => visible = true, 500);
		}
	});
</script>

<div class="chat {message.role === 'user' ? 'chat-end' : 'chat-start'}">
	<div class="chat-bubble {message.role === 'user' ? 'chat-bubble-primary' : ''} whitespace-pre-wrap">
		{message.content}
		{#if message.streaming}
			<span class="loading loading-dots loading-xs ml-1"></span>
		{/if}
	</div>
</div>

{#if message.products?.length > 0 && visible}
	<div class="ml-2 mt-2 transition-all duration-300" class:opacity-0={!visible} class:opacity-100={visible}>
		<!-- Кнопка развернуть/свернуть -->
		<button
			class="btn btn-sm btn-ghost gap-2 text-primary"
			onclick={() => expanded = !expanded}
		>
			<Package size={16} />
			{expanded ? "Скрыть" : "Показать"} товары ({message.products.length})
			{#if expanded}
				<ChevronUp size={14} />
			{:else}
				<ChevronDown size={14} />
			{/if}
		</button>

		{#if expanded}
			<div class="space-y-1 mt-2">
				{#each message.products as product (product.id)}
					<!-- Компактная карточка: артикул + название + кнопка -->
					<div
						class="flex items-center gap-2 p-2 bg-base-100 rounded-lg shadow-sm cursor-pointer hover:bg-base-200 transition-colors"
						onclick={() => onselect?.(product)}
						role="button"
						tabindex="0"
					>
						<div class="flex-1 min-w-0">
							<span class="text-xs font-mono text-primary">{product.article}</span>
							<p class="text-sm leading-tight truncate">{product.name}</p>
						</div>
						<button
							class="btn btn-xs btn-circle shrink-0 {cartIds.has(product.id) ? 'btn-success' : 'btn-primary'}"
							onclick={(e) => { e.stopPropagation(); cartIds.has(product.id) ? onremove?.(product.id) : onadd?.(product); }}
						>
							{#if cartIds.has(product.id)}
								<Check size={12} />
							{:else}
								<Plus size={12} />
							{/if}
						</button>
					</div>
				{/each}

				<!-- Добавить всё -->
				<button
					class="btn btn-xs btn-secondary w-full gap-1 mt-1"
					onclick={() => onaddall?.(message.products)}
				>
					Добавить всё в список
				</button>
			</div>
		{/if}
	</div>
{/if}
