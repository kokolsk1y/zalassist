<script>
	import { base } from "$app/paths";
	import { onMount, onDestroy } from "svelte";
	import { ArrowLeft, Send, MessageSquare, ShoppingCart } from "lucide-svelte";
	import { loadCatalog } from "$lib/data/catalog.js";
	import { formatCatalogForAI } from "$lib/ai/prompt.js";
	import { streamChat } from "$lib/ai/client.js";
	import { extractProducts } from "$lib/ai/parse.js";
	import { cart } from "$lib/stores/cart.svelte.js";
	import ChatMessage from "$lib/components/ChatMessage.svelte";
	import QuickChips from "$lib/components/QuickChips.svelte";
	import CartPanel from "$lib/components/CartPanel.svelte";

	const INITIAL_CHIPS = [
		"Нужна помощь с электрикой",
		"Собираю щиток",
		"Что выбрать для розеток?"
	];

	const DEFAULT_FOLLOWUP = [
		"Что ещё понадобится?",
		"Покажи аналоги",
		"Расскажи подробнее"
	];

	/**
	 * Извлечь chips из ответа ИИ: [CHIPS: вариант1 | вариант2 | вариант3]
	 * Возвращает { text, chips } — очищенный текст и массив chips.
	 */
	function parseChipsFromResponse(text) {
		const match = text.match(/\[CHIPS:\s*(.+?)\]\s*$/);
		if (match) {
			const chips = match[1].split("|").map(c => c.trim()).filter(Boolean);
			const cleanText = text.slice(0, match.index).trimEnd();
			return { text: cleanText, chips };
		}
		return { text, chips: null };
	}

	let messages = $state([]);
	let inputText = $state("");
	let isLoading = $state(false);
	let error = $state(null);
	let catalogItems = $state([]);
	let catalogCompact = $state("");
	let abortFn = $state(null);
	let chatContainer;
	let showCart = $state(false);

	let cartIds = $derived(new Set(cart.items.map(i => i.id)));
	let canSend = $derived(inputText.trim().length > 0 && inputText.length <= 500 && !isLoading);
	let aiChips = $state(null); // chips спарсенные из ответа ИИ
	let currentChips = $derived(
		messages.length === 0 ? INITIAL_CHIPS :
		isLoading ? [] :
		aiChips || DEFAULT_FOLLOWUP
	);

	onMount(async () => {
		try {
			const catalog = await loadCatalog();
			catalogItems = catalog.items;
			catalogCompact = formatCatalogForAI(catalog.items);
		} catch (e) {
			error = "Не удалось загрузить каталог";
			console.error(e);
		}
	});

	onDestroy(() => {
		abortFn?.();
	});

	function sendMessage(text) {
		if (!text?.trim() || isLoading) return;
		const userMsg = text.trim().slice(0, 500);
		inputText = "";
		error = null;
		aiChips = null;

		messages.push({ role: "user", content: userMsg, products: null, streaming: false });

		const aiMsgIndex = messages.length;
		messages.push({ role: "assistant", content: "", products: null, streaming: true });
		isLoading = true;

		const history = messages.slice(0, -2)
			.filter(m => m.role === "user" || m.role === "assistant")
			.map(m => ({ role: m.role, content: m.content }))
			.slice(-20);

		abortFn = streamChat({
			message: userMsg,
			history,
			catalog: catalogCompact,
			onChunk(chunk, fullText) {
				messages[aiMsgIndex].content = fullText;
			},
			onDone(fullText) {
				const { text: cleanText, chips } = parseChipsFromResponse(fullText);
				messages[aiMsgIndex].content = cleanText;
				messages[aiMsgIndex].streaming = false;
				messages[aiMsgIndex].products = extractProducts(cleanText, catalogItems);
				aiChips = chips; // ИИ сам предложил подсказки
				isLoading = false;
				abortFn = null;
			},
			onError(errMsg) {
				messages[aiMsgIndex].content = errMsg;
				messages[aiMsgIndex].streaming = false;
				isLoading = false;
				error = errMsg;
				abortFn = null;
			}
		});
	}

	// Auto-scroll
	$effect(() => {
		const _ = messages.length > 0 && messages[messages.length - 1]?.content;
		if (chatContainer) {
			requestAnimationFrame(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			});
		}
	});

	function handleAdd(product) { cart.add(product); }
	function handleRemove(id) { cart.remove(id); }
	function handleAddAll(products) { products.forEach(p => cart.add(p)); }
	function handleChipSelect(chipText) { sendMessage(chipText); }
	function handleKeydown(e) {
		if (e.key === "Enter" && !e.shiftKey && canSend) {
			e.preventDefault();
			sendMessage(inputText);
		}
	}
</script>

<div class="flex flex-col h-[100dvh] bg-base-200">
	<!-- Header -->
	<div class="navbar bg-base-100 shadow-sm px-2 min-h-0 py-2">
		<a href="{base}/" class="btn btn-ghost btn-sm btn-circle" aria-label="Назад" data-sveltekit-reload>
			<ArrowLeft size={20} />
		</a>
		<span class="text-lg font-bold ml-2 flex-1">Подбор под задачу</span>
		{#if cart.count > 0}
			<button
				class="btn btn-primary btn-sm btn-circle relative"
				onclick={() => showCart = true}
				aria-label="Список товаров"
			>
				<ShoppingCart size={16} />
				<span class="absolute -top-1 -right-1 badge badge-secondary badge-xs">{cart.count}</span>
			</button>
		{/if}
	</div>

	<!-- Messages area -->
	<div class="flex-1 overflow-y-auto p-4 space-y-2" bind:this={chatContainer}>
		{#if messages.length === 0}
			<div class="text-center text-base-content/50 mt-8">
				<div class="flex justify-center mb-2 opacity-50">
					<MessageSquare size={32} />
				</div>
				<p>Опишите задачу или выберите подсказку</p>
			</div>
		{/if}

		{#each messages as message, i (i)}
			<ChatMessage
				{message}
				{cartIds}
				onadd={handleAdd}
				onremove={handleRemove}
				onaddall={handleAddAll}
			/>
		{/each}

		{#if error}
			<div class="alert alert-error text-sm">
				{error}
			</div>
		{/if}
	</div>

	<!-- Quick chips -->
	{#if currentChips.length > 0}
		<QuickChips
			chips={currentChips}
			onselect={handleChipSelect}
			disabled={isLoading}
		/>
	{/if}

	<!-- Disclaimer -->
	<p class="text-xs text-base-content/40 text-center px-4">
		Наличие и цены уточняйте у консультанта
	</p>

	<!-- Input area -->
	<div class="p-3 bg-base-100 border-t border-base-300 flex gap-2 items-end safe-bottom">
		<textarea
			class="textarea textarea-bordered flex-1 min-h-[44px] max-h-[120px] resize-none text-base"
			placeholder="Опишите задачу..."
			bind:value={inputText}
			onkeydown={handleKeydown}
			maxlength="500"
			rows="1"
			disabled={isLoading}
		></textarea>
		<button
			class="btn btn-primary btn-circle"
			onclick={() => sendMessage(inputText)}
			disabled={!canSend}
			aria-label="Отправить"
		>
			<Send size={20} />
		</button>
	</div>

	<!-- Character counter -->
	{#if inputText.length > 400}
		<p class="text-xs text-center pb-1 {inputText.length > 500 ? 'text-error' : 'text-base-content/40'}">
			{inputText.length}/500
		</p>
	{/if}
</div>

<!-- Cart panel -->
<CartPanel open={showCart} onclose={() => showCart = false} />
