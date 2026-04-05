<script>
	import { base } from "$app/paths";
	import { Package, Plus, Check, ChevronDown, ChevronUp, PackageOpen } from "lucide-svelte";

	let { message, onadd, onremove, onaddall, onselect, cartIds = new Set() } = $props();
	let expanded = $state(true);
	let visible = $state(false);

	// Плавное появление карточек после ответа ИИ
	$effect(() => {
		if (message.products?.length > 0 && !message.streaming) {
			setTimeout(() => visible = true, 500);
		}
	});

	function formatPrice(price) {
		if (!price) return "";
		return price.toLocaleString("ru-RU") + " ₽";
	}

	/**
	 * Разбивает текст на сегменты: обычный текст и артикулы.
	 * Убирает markdown ** вокруг артикулов.
	 */
	function parseContent(text, products) {
		if (!text) return [{ type: "text", value: "" }];

		// Убираем markdown bold ** из текста
		let clean = text.replace(/\*\*/g, "");

		if (!products || products.length === 0) {
			return [{ type: "text", value: clean }];
		}

		// Собираем артикулы для подсветки
		const articles = products
			.map(p => p.article)
			.filter(Boolean)
			.sort((a, b) => b.length - a.length); // длинные первыми

		if (articles.length === 0) return [{ type: "text", value: clean }];

		// Создаём regex для всех артикулов (case-insensitive)
		const escaped = articles.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
		const re = new RegExp(`(${escaped.join("|")})`, "gi");

		const segments = [];
		let lastIndex = 0;
		let match;
		while ((match = re.exec(clean)) !== null) {
			if (match.index > lastIndex) {
				segments.push({ type: "text", value: clean.slice(lastIndex, match.index) });
			}
			segments.push({ type: "article", value: match[0] });
			lastIndex = re.lastIndex;
		}
		if (lastIndex < clean.length) {
			segments.push({ type: "text", value: clean.slice(lastIndex) });
		}

		return segments.length > 0 ? segments : [{ type: "text", value: clean }];
	}
</script>

<div class="chat {message.role === 'user' ? 'chat-end' : 'chat-start'}">
	{#if message.role === 'assistant'}
		<div class="chat-image avatar">
			<div class="w-8 rounded-full bg-white shadow-sm">
				<img src="{base}/ai-avatar.png" alt="AI" />
			</div>
		</div>
	{/if}
	<div class="chat-bubble {message.role === 'user' ? 'chat-bubble-primary' : ''} whitespace-pre-wrap">
		{#if message.role === 'assistant' && message.products?.length > 0}
			{#each parseContent(message.content, message.products) as seg}
				{#if seg.type === "article"}
					<span class="article-code bg-white/15 rounded px-1">{seg.value}</span>
				{:else}
					{seg.value}
				{/if}
			{/each}
		{:else}
			{message.content}
		{/if}
		{#if message.streaming}
			<span class="loading loading-dots loading-xs ml-1"></span>
		{/if}
	</div>
</div>

{#if message.products?.length > 0 && visible}
	<div class="ml-2 mt-2 transition-all duration-300" class:opacity-0={!visible} class:opacity-100={visible}>
		<!-- Кнопка развернуть/свернуть -->
		<button
			class="btn btn-ghost gap-2 text-primary min-h-[44px]"
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
			<div class="space-y-2 mt-2">
				{#each message.products as product (product.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="flex gap-3 p-2.5 bg-base-100 rounded-xl shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
						onclick={() => onselect?.(product)}
						onkeydown={(e) => { if (e.key === "Enter") onselect?.(product); }}
						role="button"
						tabindex="0"
					>
						<!-- Мини-фото -->
						<div class="w-14 h-14 rounded-lg bg-base-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
							{#if product.photo}
								<img src={product.photo} alt="" class="w-full h-full object-contain" loading="lazy" />
							{:else}
								<PackageOpen size={20} class="text-base-content/20" />
							{/if}
						</div>

						<div class="flex-1 min-w-0">
							<p class="text-sm leading-tight line-clamp-2">{product.name}</p>
							<div class="flex items-center gap-2 mt-1">
								<span class="text-[13px] article-code">Арт. {product.article}</span>
								{#if product.price}
									<span class="text-sm font-bold">{formatPrice(product.price)}</span>
								{/if}
							</div>
						</div>

						<button
							class="btn btn-circle shrink-0 self-center min-h-[44px] min-w-[44px] {cartIds.has(product.id) ? 'btn-success' : 'btn-primary'}"
							onclick={(e) => { e.stopPropagation(); cartIds.has(product.id) ? onremove?.(product.id) : onadd?.(product); }}
						>
							{#if cartIds.has(product.id)}
								<Check size={20} />
							{:else}
								<Plus size={20} />
							{/if}
						</button>
					</div>
				{/each}

				<!-- Добавить всё -->
				<button
					class="btn btn-secondary w-full gap-1 mt-1 min-h-[44px]"
					onclick={() => onaddall?.(message.products)}
				>
					Добавить всё в список
				</button>
			</div>
		{/if}
	</div>
{/if}
