<script>
	import { base } from "$app/paths";
	import { goto } from "$app/navigation";
	import { onMount, onDestroy } from "svelte";
	import { ArrowLeft, Send, MessageSquare, Headphones } from "lucide-svelte";
	import { loadCatalog } from "$lib/data/catalog.js";
	import { formatCatalogForAI, selectItemsForAI } from "$lib/ai/prompt.js";
	import { streamChat } from "$lib/ai/client.js";
	import { extractProducts } from "$lib/ai/parse.js";
	import { speakSentences, cancelSpeech, isSpeechSupported, primeSpeech, isIOS } from "$lib/ai/speech.js";
	import { isRecognitionSupported } from "$lib/ai/recognize.js";
	import { monitorAudioLevel } from "$lib/utils/audio-level.js";
	import { createSearchEngine } from "$lib/search/engine.js";
	import { useCart } from "$lib/stores/cart.svelte.js";
	import * as haptics from "$lib/utils/haptics.js";
	import ChatMessage from "$lib/components/ChatMessage.svelte";
	import QuickChips from "$lib/components/QuickChips.svelte";
	import ProductSheet from "$lib/components/ProductSheet.svelte";
	import VoiceRecordButton from "$lib/components/VoiceRecordButton.svelte";
	import VoiceCallScreen from "$lib/components/VoiceCallScreen.svelte";

	const cart = useCart();
	const isIosDevice = isIOS();

	const INITIAL_CHIPS = [
		"Нужна помощь с электрикой",
		"Собираю щиток",
		"Что выбрать для розеток?",
	];
	const DEFAULT_FOLLOWUP = ["Что ещё понадобится?", "Покажи аналоги", "Расскажи подробнее"];

	// Префикс для voice-режима — ИИ переключается на разговорный стиль (Алиса-style:
	// 1-2 коротких предложения, без таблиц/диктовки артикулов).
	const VOICE_PREFIX = "[ГОЛОСОВОЙ РЕЖИМ — отвечай разговорно, 1-2 коротких предложения, без таблиц, без диктовки артикулов. Артикулы и список товаров система покажет на экране, тебе их озвучивать не нужно.] ";

	function parseChipsFromResponse(text) {
		const match = text.match(/\[CHIPS:\s*(.+?)\]\s*$/);
		if (match) {
			const chips = match[1].split("|").map(c => c.trim()).filter(Boolean);
			return { text: text.slice(0, match.index).trimEnd(), chips };
		}
		return { text, chips: null };
	}

	let messages = $state([]);
	let inputText = $state("");
	let isLoading = $state(false);
	let error = $state(null);
	let catalogItems = $state([]);
	let searchEngine = $state(null);
	let abortFn = $state(null);
	let chatScroll;        // ссылка на scroll-контейнер
	let inputEl;            // textarea
	let selectedProduct = $state(null);
	let aiChips = $state(null);

	// Hands-free «звонок» — fullscreen VoiceCallScreen
	let callOpen = $state(false);
	let callState = $state("idle");
	let callLastReply = $state("");
	let callLastError = $state("");
	let stopBargeIn = null;
	const voiceSupported = isSpeechSupported() && isRecognitionSupported();

	function getCanSend() {
		return inputText.trim().length > 0 && inputText.length <= 1500 && !isLoading;
	}
	function getCurrentChips() {
		if (messages.length === 0) return INITIAL_CHIPS;
		if (isLoading) return [];
		return aiChips || DEFAULT_FOLLOWUP;
	}

	// === visualViewport sync — ключ к корректной верстке на iOS ===
	// Telegram Web использует именно этот паттерн: при появлении клавиатуры
	// visualViewport.height уменьшается, а offsetTop может стать > 0 (visible
	// область сдвигается). 100dvh / position:fixed без учёта offsetTop — не
	// прижимаются к visible viewport, поэтому шапка и input уплывают.
	function attachViewportSync() {
		if (typeof window === "undefined" || !window.visualViewport) return () => {};
		const vv = window.visualViewport;
		const root = document.documentElement;
		const update = () => {
			root.style.setProperty("--vv-h", `${vv.height}px`);
			root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
		};
		update();
		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		return () => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
			root.style.removeProperty("--vv-h");
			root.style.removeProperty("--vv-top");
		};
	}

	let detachViewport = () => {};

	onMount(async () => {
		// Помечаем body — это сигнал layout'у что мы внутри чата (BottomNav скрыт)
		document.body.classList.add("in-chat");
		detachViewport = attachViewportSync();

		try {
			const catalog = await loadCatalog();
			catalogItems = catalog.items;
			searchEngine = createSearchEngine(catalog.items);
		} catch {
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
		scrollToBottom();
	});

	onDestroy(() => {
		if (typeof document !== "undefined") {
			document.body.classList.remove("in-chat");
		}
		detachViewport();
		abortFn?.();
		stopBargeIn?.();
		cancelSpeech();
	});

	function saveChat() {
		try {
			const toSave = messages.map(m => ({ role: m.role, content: m.content, products: m.products }));
			sessionStorage.setItem("zalassist-chat", JSON.stringify(toSave));
		} catch {}
	}

	function scrollToBottom() {
		if (!chatScroll) return;
		requestAnimationFrame(() => {
			chatScroll.scrollTop = chatScroll.scrollHeight;
		});
	}

	function autoResizeInput() {
		if (!inputEl) return;
		inputEl.style.height = "auto";
		inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
	}

	async function sendMessage(text, { fromVoice = false } = {}) {
		if (!text?.trim() || isLoading) return;
		const userMsg = text.trim().slice(0, 1500);
		const messageForAI = fromVoice ? VOICE_PREFIX + userMsg : userMsg;
		inputText = "";
		autoResizeInput();
		error = null;
		aiChips = null;

		messages = [...messages, { role: "user", content: userMsg, products: null, streaming: false }];
		const aiMsgIndex = messages.length;
		messages = [...messages, { role: "assistant", content: "", products: null, streaming: true }];
		isLoading = true;
		scrollToBottom();

		const history = messages
			.slice(0, -2)
			.filter(m => m.role === "user" || m.role === "assistant")
			.map(m => ({ role: m.role, content: m.content }))
			.slice(-20);

		let catalogSubset = null;
		if (searchEngine && catalogItems.length > 0) {
			const relevant = selectItemsForAI(userMsg, history, searchEngine, catalogItems, 50);
			catalogSubset = formatCatalogForAI(relevant);
		}

		abortFn = streamChat({
			message: messageForAI,
			history,
			catalogSubset,
			onChunk(_delta, fullText) {
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
				if (callOpen) speakReplyInCall(cleanText);
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
				if (callOpen) {
					callState = "error";
					callLastError = errMsg;
				}
				scrollToBottom();
			},
		});
	}

	// === Hands-free звонок ===
	function openCall() {
		if (!voiceSupported) return;
		haptics.tap();
		primeSpeech();
		callLastError = "";
		callLastReply = "";
		callState = "idle";
		callOpen = true;
	}
	function closeCall() {
		callOpen = false;
		callState = "idle";
		stopBargeIn?.();
		stopBargeIn = null;
		cancelSpeech();
	}
	function handleCallMessage(text) {
		callState = "thinking";
		sendMessage(text, { fromVoice: true });
	}
	async function speakReplyInCall(replyText) {
		if (!callOpen) return;
		callState = "speaking";
		callLastReply = replyText;

		// Barge-in только на Android — на iOS getUserMedia переключает аудио на earpiece
		if (!isIosDevice) {
			stopBargeIn?.();
			stopBargeIn = await monitorAudioLevel({
				threshold: 0.08,
				onSpeech: () => {
					if (callState === "speaking") {
						cancelSpeech();
						stopBargeIn?.();
						stopBargeIn = null;
					}
				},
			});
		}

		await speakSentences(replyText, {
			rate: 1.05,
			maxLength: 280,
			onSentenceStart: (s) => { callLastReply = s; },
		});

		stopBargeIn?.();
		stopBargeIn = null;
		if (callOpen) callState = "idle";
	}
	function interruptSpeech() {
		if (callState !== "speaking") return;
		haptics.tap();
		cancelSpeech();
		stopBargeIn?.();
		stopBargeIn = null;
		callState = "idle";
	}

	function handleAdd(product) { cart.add(product); }
	function handleRemove(id) { cart.remove(id); }
	function handleAddAll(products) { products.forEach(p => cart.add(p)); }
	function handleChipSelect(chipText) { sendMessage(chipText); }
	function handleVoiceResult(text) { sendMessage(text); }
	function handleKeydown(e) {
		if (e.key === "Enter" && !e.shiftKey && getCanSend()) {
			e.preventDefault();
			sendMessage(inputText);
		}
	}
</script>

<div class="chat-root">
	<header class="chat-header">
		<button onclick={() => goto(`${base}/`)} class="header-btn" aria-label="Назад">
			<ArrowLeft size={22} />
		</button>
		<span class="header-title">AI-помощник</span>
		{#if voiceSupported}
			<button class="header-btn" onclick={openCall} aria-label="Голосовой режим">
				<Headphones size={20} />
			</button>
		{/if}
	</header>

	<div class="chat-scroll" bind:this={chatScroll}>
		{#if messages.length === 0}
			<div class="chat-empty">
				<div class="empty-icon">
					<MessageSquare size={32} />
				</div>
				<h2>Расскажите задачу</h2>
				<p>
					Опишите что нужно — соберу список товаров.{#if voiceSupported}<br/>Можно говорить голосом — удерживайте микрофон.{/if}
				</p>
			</div>
		{/if}

		{#each messages as message, i (i)}
			<ChatMessage
				{message}
				cartIds={new Set(cart.items.map(i => i.id))}
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
		<div class="chat-chips">
			<QuickChips chips={getCurrentChips()} onselect={handleChipSelect} disabled={isLoading} />
		</div>
	{/if}

	<footer class="chat-input">
		<textarea
			bind:this={inputEl}
			class="input-field"
			placeholder="Сообщение..."
			bind:value={inputText}
			oninput={autoResizeInput}
			onkeydown={handleKeydown}
			maxlength="1500"
			rows="1"
			disabled={isLoading}
		></textarea>

		{#if inputText.trim()}
			<button class="send-btn" onclick={() => sendMessage(inputText)} disabled={!getCanSend()} aria-label="Отправить">
				<Send size={20} />
			</button>
		{:else}
			<VoiceRecordButton size={44} disabled={isLoading} onresult={handleVoiceResult} />
		{/if}
	</footer>

	{#if inputText.length > 1200}
		<div class="char-counter" class:over={inputText.length > 1500}>
			{inputText.length}/1500
		</div>
	{/if}
</div>

<ProductSheet
	product={selectedProduct}
	onclose={() => selectedProduct = null}
	onadd={handleAdd}
/>

{#if callOpen}
	<VoiceCallScreen
		externalState={callState}
		lastReply={callLastReply}
		lastError={callLastError}
		onmessage={handleCallMessage}
		onclose={closeCall}
		oninterrupt={interruptSpeech}
	/>
{/if}

<style>
	/* === Telegram-style fullscreen чат ===
	   chat-root прибивается к visible viewport через --vv-top / --vv-h, которые
	   JS подвязывает к window.visualViewport. Это критично для iOS Safari —
	   без offsetTop fixed-элементы остаются на старом месте, когда visible
	   область уехала вверх под клавиатурой.
	   Fallback на 100dvh для серверного рендеринга и старых браузеров. */
	.chat-root {
		position: fixed;
		left: 0;
		right: 0;
		top: var(--vv-top, 0px);
		height: var(--vv-h, 100dvh);
		display: flex;
		flex-direction: column;
		background: var(--color-base-200);
		z-index: 60;
		overflow: hidden;
	}

	.chat-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 8px;
		padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
		background: var(--color-base-100);
		border-bottom: 1px solid var(--color-base-300);
	}
	.header-btn {
		min-width: 44px;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		color: var(--color-base-content);
		background: transparent;
		border: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.header-btn:active {
		background: color-mix(in oklch, var(--color-base-content) 10%, transparent);
	}
	.header-title {
		flex: 1;
		font-size: 17px;
		font-weight: 600;
		color: var(--color-base-content);
	}

	.chat-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		-webkit-overflow-scrolling: touch;
	}

	.chat-empty {
		text-align: center;
		margin-top: 48px;
		padding: 0 24px;
	}
	.empty-icon {
		width: 64px;
		height: 64px;
		margin: 0 auto 16px;
		border-radius: 16px;
		background: color-mix(in oklch, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.chat-empty h2 {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 8px;
		color: var(--color-base-content);
	}
	.chat-empty p {
		font-size: 14px;
		line-height: 1.5;
		color: color-mix(in oklch, var(--color-base-content) 60%, transparent);
	}

	.chat-chips {
		flex-shrink: 0;
	}

	.chat-input {
		flex-shrink: 0;
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 8px 12px;
		padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
		background: var(--color-base-100);
		border-top: 1px solid var(--color-base-300);
	}
	.input-field {
		flex: 1;
		min-height: 44px;
		max-height: 120px;
		padding: 10px 14px;
		border-radius: 22px;
		border: 1px solid var(--color-base-300);
		background: var(--color-base-200);
		color: var(--color-base-content);
		font-size: 16px;
		line-height: 1.4;
		font-family: inherit;
		resize: none;
		outline: none;
		transition: border-color 0.15s ease;
	}
	.input-field:focus {
		border-color: var(--color-primary);
	}
	.input-field:disabled {
		opacity: 0.6;
	}
	.send-btn {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: 9999px;
		border: none;
		background: var(--color-primary);
		color: var(--color-primary-content);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: opacity 0.15s ease, transform 0.1s ease;
	}
	.send-btn:active {
		transform: scale(0.94);
	}
	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.char-counter {
		flex-shrink: 0;
		font-size: 11px;
		text-align: center;
		padding-bottom: 4px;
		color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
	}
	.char-counter.over {
		color: var(--color-error);
	}
</style>
