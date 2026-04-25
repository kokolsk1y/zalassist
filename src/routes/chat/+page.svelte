<script>
	import { base } from "$app/paths";
	import { goto } from "$app/navigation";
	import { onMount, onDestroy } from "svelte";
	import { ArrowLeft, Send, MessageSquare, Headphones, Square } from "lucide-svelte";
	import { loadCatalog } from "$lib/data/catalog.js";
	import { formatCatalogForAI, selectItemsForAI } from "$lib/ai/prompt.js";
	import { streamChat } from "$lib/ai/client.js";
	import { extractProducts } from "$lib/ai/parse.js";
	import { speak, cancelSpeech, isSpeechSupported } from "$lib/ai/speech.js";
	import { recognizeOnce, isRecognitionSupported } from "$lib/ai/recognize.js";
	import { createSearchEngine } from "$lib/search/engine.js";
	import { cartStore, cartAdd, cartRemove } from "$lib/stores/cart.js";
	import * as haptics from "$lib/utils/haptics.js";
	import ChatMessage from "$lib/components/ChatMessage.svelte";
	import QuickChips from "$lib/components/QuickChips.svelte";
	import ProductSheet from "$lib/components/ProductSheet.svelte";
	import VoiceInput from "$lib/components/VoiceInput.svelte";

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

	function parseChipsFromResponse(text) {
		const match = text.match(/\[CHIPS:\s*(.+?)\]\s*$/);
		if (match) {
			const chips = match[1].split("|").map(c => c.trim()).filter(Boolean);
			const cleanText = text.slice(0, match.index).trimEnd();
			return { text: cleanText, chips };
		}
		return { text, chips: null };
	}

	let cartItems = $state([]);

	let messages = $state([]);
	let inputText = $state("");
	let isLoading = $state(false);
	let error = $state(null);
	let catalogItems = $state([]);
	let searchEngine = $state(null);
	let abortFn = $state(null);
	let chatContainer;
	let selectedProduct = $state(null);
	let aiChips = $state(null);

	// Hands-free режим: ИИ озвучивает ответ → автоматически перезапускает микрофон.
	let voiceMode = $state(false);
	let voiceState = $state("idle"); // "idle" | "listening" | "thinking" | "speaking"
	let voiceSession = null;
	const voiceSupported = isSpeechSupported() && isRecognitionSupported();

	function getCartIds() { return new Set(cartItems.map(i => i.id)); }
	function getCanSend() { return inputText.trim().length > 0 && inputText.length <= 1500 && !isLoading; }
	function getCurrentChips() {
		if (messages.length === 0) return INITIAL_CHIPS;
		if (isLoading) return [];
		return aiChips || DEFAULT_FOLLOWUP;
	}

	onMount(async () => {
		const unsub = cartStore.subscribe(v => { cartItems = v; });

		try {
			const catalog = await loadCatalog();
			catalogItems = catalog.items;
			searchEngine = createSearchEngine(catalog.items);
		} catch (e) {
			error = "Не удалось загрузить каталог";
		}
		try {
			const saved = sessionStorage.getItem("zalassist-chat");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed) && parsed.length > 0) {
					messages = parsed.map(m => ({ ...m, streaming: false }));
				}
			}
		} catch {}
	});

	onDestroy(() => {
		abortFn?.();
	});

	function saveChat() {
		try {
			const toSave = messages.map(m => ({ role: m.role, content: m.content, products: m.products }));
			sessionStorage.setItem("zalassist-chat", JSON.stringify(toSave));
		} catch {}
	}

	function scrollToBottom() {
		if (chatContainer) {
			requestAnimationFrame(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			});
		}
	}

	async function sendMessage(text) {
		if (!text?.trim() || isLoading) return;
		const userMsg = text.trim().slice(0, 1500);
		inputText = "";
		error = null;
		aiChips = null;

		messages = [...messages, { role: "user", content: userMsg, products: null, streaming: false }];
		const aiMsgIndex = messages.length;
		messages = [...messages, { role: "assistant", content: "", products: null, streaming: true }];
		isLoading = true;
		scrollToBottom();

		const history = messages.slice(0, -2)
			.filter(m => m.role === "user" || m.role === "assistant")
			.map(m => ({ role: m.role, content: m.content }))
			.slice(-20);

		// Предварительный поиск: отбираем 50 релевантных товаров для AI
		let catalogSubset = null;
		if (searchEngine && catalogItems.length > 0) {
			const relevant = selectItemsForAI(userMsg, history, searchEngine, catalogItems, 50);
			catalogSubset = formatCatalogForAI(relevant);
		}

		abortFn = streamChat({
			message: userMsg,
			history,
			catalogSubset,
			onChunk(delta, fullText) {
				// Скрываем [CHIPS:...] во время стриминга
				const clean = fullText.replace(/\[CHIPS:.*$/s, "").trimEnd();
				messages[aiMsgIndex] = { ...messages[aiMsgIndex], content: clean, streaming: true };
				messages = [...messages];
				scrollToBottom();
			},
			onDone(fullText) {
				const { text: cleanText, chips } = parseChipsFromResponse(fullText);
				messages[aiMsgIndex] = {
					...messages[aiMsgIndex],
					content: cleanText,
					streaming: false,
					products: extractProducts(cleanText, catalogItems),
				};
				messages = [...messages];
				aiChips = chips;
				isLoading = false;
				abortFn = null;
				saveChat();
				scrollToBottom();
				// Hands-free: озвучить ответ → запустить микрофон
				if (voiceMode) handleVoiceLoop(cleanText);
			},
			onError(errMsg) {
				messages[aiMsgIndex] = {
					...messages[aiMsgIndex],
					content: "Ошибка: " + errMsg,
					streaming: false,
				};
				messages = [...messages];
				error = errMsg;
				isLoading = false;
				abortFn = null;
				scrollToBottom();
			},
		});
	}

	async function handleVoiceLoop(replyText) {
		if (!voiceMode) return;
		voiceState = "speaking";
		await speak(replyText, { rate: 1.05 });
		if (!voiceMode) { voiceState = "idle"; return; }
		// Микрофон запускаем после короткой паузы — иначе TTS «слышит сам себя» на динамиках
		await new Promise((r) => setTimeout(r, 350));
		if (!voiceMode) { voiceState = "idle"; return; }
		voiceState = "listening";
		haptics.tap();
		voiceSession = recognizeOnce({
			onEnd: () => {},
		});
		const text = await voiceSession.promise;
		voiceSession = null;
		if (!voiceMode) { voiceState = "idle"; return; }
		if (text && text.trim()) {
			voiceState = "thinking";
			sendMessage(text);
		} else {
			voiceState = "idle"; // пользователь молчал — ждём ручного действия
		}
	}

	function toggleVoiceMode() {
		if (!voiceSupported) return;
		haptics.tap();
		if (voiceMode) {
			// Выход из режима — глушим всё
			voiceMode = false;
			voiceState = "idle";
			cancelSpeech();
			voiceSession?.abort();
			voiceSession = null;
			return;
		}
		voiceMode = true;
		// Сразу слушаем — пользователь нажал кнопку, ждать нечего
		voiceState = "listening";
		voiceSession = recognizeOnce();
		voiceSession.promise.then((text) => {
			voiceSession = null;
			if (!voiceMode) return;
			if (text && text.trim()) {
				voiceState = "thinking";
				sendMessage(text);
			} else {
				voiceState = "idle";
			}
		});
	}

	function handleAdd(product) {
		cartAdd(product);
	}
	function handleRemove(id) {
		cartRemove(id);
	}
	function handleAddAll(products) {
		products.forEach(p => cartAdd(p));
	}
	function handleChipSelect(chipText) { sendMessage(chipText); }
	function handleKeydown(e) {
		if (e.key === "Enter" && !e.shiftKey && getCanSend()) {
			e.preventDefault();
			sendMessage(inputText);
		}
	}
</script>

<div class="flex flex-col h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px))] bg-base-200">
	<div class="navbar bg-base-100 shadow-sm px-2 min-h-0 py-2">
		<button onclick={() => goto(`${base}/`)} class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]" aria-label="Назад">
			<ArrowLeft size={22} />
		</button>
		<span class="text-lg font-bold ml-2 flex-1">Подбор под задачу</span>
		{#if voiceSupported}
			<button
				class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px] {voiceMode ? 'text-primary' : 'text-base-content/60'}"
				onclick={toggleVoiceMode}
				aria-label={voiceMode ? "Выключить голосовой режим" : "Голосовой режим"}
				title={voiceMode ? "Голосовой режим включён" : "Голосовой режим"}
			>
				<Headphones size={22} />
			</button>
		{/if}
	</div>

	{#if voiceMode}
		<div class="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-3 text-sm">
			<span class="relative flex h-3 w-3">
				<span
					class="absolute inline-flex h-full w-full rounded-full {voiceState === 'listening' ? 'bg-error animate-ping' : voiceState === 'speaking' ? 'bg-primary animate-pulse' : voiceState === 'thinking' ? 'bg-warning animate-pulse' : 'bg-base-content/30'}"
				></span>
				<span class="relative inline-flex h-3 w-3 rounded-full {voiceState === 'listening' ? 'bg-error' : voiceState === 'speaking' ? 'bg-primary' : voiceState === 'thinking' ? 'bg-warning' : 'bg-base-content/30'}"></span>
			</span>
			<span class="flex-1 text-base-content/80">
				{#if voiceState === "listening"}Слушаю — говорите{:else if voiceState === "speaking"}Отвечаю голосом…{:else if voiceState === "thinking"}Подбираю товары…{:else}Голосовой режим — нажмите чтобы говорить{/if}
			</span>
			<button
				class="btn btn-xs btn-circle btn-ghost"
				onclick={toggleVoiceMode}
				aria-label="Выключить голосовой режим"
			>
				<Square size={14} />
			</button>
		</div>
	{/if}

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
				cartIds={getCartIds()}
				onadd={handleAdd}
				onremove={handleRemove}
				onaddall={handleAddAll}
				onselect={(p) => selectedProduct = p}
			/>
		{/each}

		{#if error}
			<div class="alert alert-error text-sm">{error}</div>
		{/if}
	</div>

	{#if getCurrentChips().length > 0}
		<QuickChips
			chips={getCurrentChips()}
			onselect={handleChipSelect}
			disabled={isLoading}
		/>
	{/if}

	<p class="text-xs text-base-content/60 text-center px-4">
		Наличие и цены уточняйте у консультанта
	</p>

	<div class="p-3 bg-base-100 border-t border-base-300 flex gap-2 items-end safe-bottom">
		<textarea
			class="textarea textarea-bordered flex-1 min-h-[44px] max-h-[120px] resize-none text-base"
			placeholder="Опишите задачу..."
			bind:value={inputText}
			onkeydown={handleKeydown}
			maxlength="1500"
			rows="1"
			disabled={isLoading}
		></textarea>
		{#if !inputText.trim()}
			<VoiceInput onResult={(text) => { inputText = text; }} size={22} />
		{/if}
		<button
			class="btn btn-primary btn-circle"
			onclick={() => sendMessage(inputText)}
			disabled={!getCanSend()}
			aria-label="Отправить"
		>
			<Send size={20} />
		</button>
	</div>

	{#if inputText.length > 1200}
		<p class="text-xs text-center pb-1 {inputText.length > 1500 ? 'text-error' : 'text-base-content/60'}">
			{inputText.length}/1500
		</p>
	{/if}
</div>

<ProductSheet
	product={selectedProduct}
	onclose={() => selectedProduct = null}
	onadd={handleAdd}
/>
