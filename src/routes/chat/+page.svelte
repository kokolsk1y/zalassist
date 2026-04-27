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

	const isIosDevice = isIOS();
	import { createSearchEngine } from "$lib/search/engine.js";
	import { cartStore, cartAdd, cartRemove } from "$lib/stores/cart.js";
	import * as haptics from "$lib/utils/haptics.js";
	import ChatMessage from "$lib/components/ChatMessage.svelte";
	import QuickChips from "$lib/components/QuickChips.svelte";
	import ProductSheet from "$lib/components/ProductSheet.svelte";
	import VoiceRecordButton from "$lib/components/VoiceRecordButton.svelte";
	import VoiceCallScreen from "$lib/components/VoiceCallScreen.svelte";

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

	// Префикс для voice-режима — ИИ переключается на разговорный стиль
	// (как Алиса: 1-2 коротких предложения, без таблиц/артикулов вслух).
	// Бэкенд (Yandex Function) принимает text как пользовательское сообщение,
	// LLM понимает такие маркеры в начале.
	const VOICE_PREFIX = "[ГОЛОСОВОЙ РЕЖИМ — отвечай разговорно, 1-2 коротких предложения, без таблиц, без диктовки артикулов. Артикулы и список товаров система покажет на экране, тебе их озвучивать не нужно.] ";

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

	// Hands-free «звонок» — fullscreen VoiceCallScreen (как Алиса).
	// Состояние делегируем компоненту через bind:state.
	let callOpen = $state(false);
	let callState = $state("idle");
	let callLastReply = $state("");
	let callLastError = $state("");
	let stopBargeIn = null; // функция остановки мониторинга микрофона
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
		if (chatContainer) {
			requestAnimationFrame(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			});
		}
	}

	async function sendMessage(text, { fromVoice = false } = {}) {
		if (!text?.trim() || isLoading) return;
		const userMsg = text.trim().slice(0, 1500);
		const messageForAI = fromVoice ? VOICE_PREFIX + userMsg : userMsg;
		inputText = "";
		error = null;
		aiChips = null;

		// В сообщениях сохраняем оригинальный текст без префикса (UI чистый)
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
			message: messageForAI,
			history,
			catalogSubset,
			onChunk(delta, fullText) {
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
				// В hands-free режиме — озвучиваем ответ и параллельно слушаем для barge-in
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
		// КРИТИЧНО: pre-warm TTS прямо в click-handler, иначе iOS заблокирует
		// первый speak() который придёт после async ответа от ИИ.
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
		// Пользователь сказал в hands-free режиме → отправляем с voice-префиксом
		callState = "thinking";
		sendMessage(text, { fromVoice: true });
	}

	async function speakReplyInCall(replyText) {
		if (!callOpen) return;
		callState = "speaking";
		callLastReply = replyText;

		// Barge-in (мониторинг микрофона во время речи) ВКЛЮЧАЕМ ТОЛЬКО на Android.
		// На iOS getUserMedia переключает аудио на earpiece (наушник у уха) вместо
		// громкого динамика — пользователь не слышит ИИ. Поэтому на iOS используем
		// tap-to-interrupt (тык в круг прерывает речь — обрабатывается в VoiceCallScreen).
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
		if (callOpen) callState = "idle"; // VoiceCallScreen сам начнёт слушать
	}

	// Tap-to-interrupt: пользователь тыкнул в круг во время speaking — прерываем
	function interruptSpeech() {
		if (callState !== "speaking") return;
		haptics.tap();
		cancelSpeech();
		stopBargeIn?.();
		stopBargeIn = null;
		callState = "idle"; // VoiceCallScreen сам перезапустит listening
	}

	function handleAdd(product) { cartAdd(product); }
	function handleRemove(id) { cartRemove(id); }
	function handleAddAll(products) { products.forEach(p => cartAdd(p)); }
	function handleChipSelect(chipText) { sendMessage(chipText); }
	function handleVoiceResult(text) {
		// Push-to-hold отдал результат — отправляем сразу (не нужно жать кнопку отправить)
		sendMessage(text);
	}
	function handleKeydown(e) {
		if (e.key === "Enter" && !e.shiftKey && getCanSend()) {
			e.preventDefault();
			sendMessage(inputText);
		}
	}
</script>

<div class="flex flex-col h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px))] bg-base-200">
	<div class="navbar bg-base-100 shadow-sm px-2 min-h-0 py-2"
		style="padding-top: calc(env(safe-area-inset-top, 0px) + 0.5rem)">
		<button onclick={() => goto(`${base}/`)} class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]" aria-label="Назад">
			<ArrowLeft size={22} />
		</button>
		<span class="text-lg font-bold ml-2 flex-1">AI-помощник</span>
		{#if voiceSupported}
			<button
				class="btn btn-ghost gap-1 min-h-[44px] px-3 text-base-content/70"
				onclick={openCall}
				aria-label="Голосовой режим"
				title="Голосовой режим — общение голосом как в звонке"
			>
				<Headphones size={20} />
				<span class="text-xs hidden sm:inline">Голос</span>
			</button>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-4 space-y-2" bind:this={chatContainer}>
		{#if messages.length === 0}
			<div class="text-center mt-12 px-6">
				<div class="flex justify-center mb-4">
					<div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
						<MessageSquare size={32} />
					</div>
				</div>
				<h2 class="text-lg font-semibold mb-2">Расскажите задачу</h2>
				<p class="text-sm text-base-content/60 leading-relaxed">
					Опишите что нужно — соберу список товаров.{#if voiceSupported}<br/>Можно говорить голосом — удерживайте микрофон.{/if}
				</p>
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

	<div class="p-3 bg-base-100 border-t border-base-300 flex gap-2 items-end safe-bottom">
		<textarea
			class="textarea textarea-bordered flex-1 min-h-[44px] max-h-[120px] resize-none text-base"
			placeholder="Сообщение..."
			bind:value={inputText}
			onkeydown={handleKeydown}
			maxlength="1500"
			rows="1"
			disabled={isLoading}
		></textarea>

		{#if inputText.trim()}
			<!-- Если что-то напечатано — показываем "Отправить" -->
			<button
				class="btn btn-primary btn-circle min-h-[48px] min-w-[48px]"
				onclick={() => sendMessage(inputText)}
				disabled={!getCanSend()}
				aria-label="Отправить"
			>
				<Send size={20} />
			</button>
		{:else}
			<!-- Поле пустое — большая push-to-hold кнопка микрофона (Telegram-style) -->
			<VoiceRecordButton
				size={48}
				disabled={isLoading}
				onresult={handleVoiceResult}
			/>
		{/if}
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
