<script>
	import { onMount, onDestroy } from "svelte";
	import { X, Pause, Play, Mic } from "lucide-svelte";
	import * as haptics from "$lib/utils/haptics.js";
	import { keepScreenAwake } from "$lib/utils/wake-lock.js";
	import { recognizeOnce } from "$lib/ai/recognize.js";
	import { cancelSpeech } from "$lib/ai/speech.js";

	// Hands-free «звонок» в стиле Яндекс Алисы.
	// Полностью самостоятельный — родитель не управляет состоянием recognition.
	// Состояние извне приходит через `externalState` (например, "speaking" когда ИИ говорит).
	// Слияние: если родитель = "speaking" → показываем speaking. Иначе — внутреннее.

	let {
		externalState = "idle", // "idle" | "thinking" | "speaking" | "error"
		lastReply = "",
		lastError = "",
		onmessage,
		onclose,
	} = $props();

	let internalState = $state("idle"); // "idle" | "listening" | "paused"
	let userPartial = $state("");
	let recognitionSession = null;
	let stopWake = null;
	let manualPause = $state(false);
	let busyExternally = $derived(externalState === "thinking" || externalState === "speaking" || externalState === "error");
	let displayState = $derived(busyExternally ? externalState : internalState);

	onMount(() => {
		stopWake = keepScreenAwake();
		// Стартуем сразу — пользователь нажал «Голос», ждать нечего
		startListening();
	});

	onDestroy(() => {
		stopWake?.();
		recognitionSession?.abort();
		cancelSpeech();
	});

	// Когда внешнее состояние возвращается в "idle" (ИИ закончил говорить) —
	// автоматически возобновляем listening.
	$effect(() => {
		if (externalState === "idle" && !manualPause && internalState !== "listening") {
			setTimeout(() => {
				if (externalState === "idle" && !manualPause && internalState !== "listening") {
					startListening();
				}
			}, 400);
		}
	});

	function startListening() {
		if (manualPause || busyExternally) return;
		// Если уже слушаем — не запускаем второй recognition
		if (recognitionSession) return;
		internalState = "listening";
		userPartial = "";
		recognitionSession = recognizeOnce({
			onError: (err) => {
				if (err === "not-allowed") {
					internalState = "error";
				}
			},
		});
		recognitionSession.promise.then((text) => {
			recognitionSession = null;
			if (manualPause) return;
			if (text && text.trim()) {
				userPartial = text;
				// Передаём текст наверх — родитель установит externalState="thinking"
				onmessage?.(text.trim());
			} else if (internalState === "listening") {
				// Тишина — слушаем ещё раз через секунду (если не на паузе и не занято)
				setTimeout(() => {
					if (!manualPause && !busyExternally && internalState === "listening") {
						internalState = "idle";
						startListening();
					}
				}, 800);
			}
		});
	}

	function togglePause() {
		haptics.tap();
		if (manualPause) {
			manualPause = false;
			internalState = "idle";
			startListening();
		} else {
			manualPause = true;
			recognitionSession?.abort();
			recognitionSession = null;
			cancelSpeech();
			internalState = "paused";
		}
	}

	function close() {
		haptics.tap();
		manualPause = true;
		recognitionSession?.abort();
		cancelSpeech();
		onclose?.();
	}

	let stateLabel = $derived(
		displayState === "listening" ? "Слушаю…" :
		displayState === "thinking" ? "Думаю…" :
		displayState === "speaking" ? "Отвечаю" :
		displayState === "paused" ? "На паузе" :
		displayState === "error" ? "Ошибка" :
		"Готов слушать"
	);
</script>

<div class="vc-root" role="dialog" aria-modal="true" aria-label="Голосовой режим">
	<div class="vc-top">
		<button class="vc-icon-btn" aria-label="Закрыть звонок" onclick={close}>
			<X size={24} />
		</button>
	</div>

	<div class="vc-center">
		<div class="vc-blob-wrap">
			<div class="vc-blob {displayState}" aria-hidden="true">
				<div class="vc-ring r1"></div>
				<div class="vc-ring r2"></div>
				<div class="vc-ring r3"></div>
				<div class="vc-core">
					{#if displayState === "paused"}
						<Pause size={48} />
					{:else}
						<Mic size={48} />
					{/if}
				</div>
			</div>
		</div>

		<p class="vc-state-label">{stateLabel}</p>

		{#if displayState === "listening" && userPartial}
			<p class="vc-user-text">«{userPartial}»</p>
		{/if}

		{#if displayState === "speaking" && lastReply}
			<p class="vc-ai-text">{lastReply}</p>
		{/if}

		{#if displayState === "error"}
			<p class="vc-error-text">{lastError || "Не получается распознать речь. Проверьте разрешение микрофона."}</p>
		{/if}
	</div>

	<div class="vc-bottom">
		<button
			class="vc-pause-btn"
			class:paused={manualPause}
			onclick={togglePause}
			aria-label={manualPause ? "Продолжить" : "Пауза"}
		>
			{#if manualPause}
				<Play size={28} />
			{:else}
				<Pause size={28} />
			{/if}
		</button>
		<p class="vc-hint">
			{#if manualPause}Нажмите чтобы продолжить{:else if displayState === "speaking"}Можно перебить голосом{:else}Скажите вслух или нажмите паузу{/if}
		</p>
	</div>
</div>

<style>
	.vc-root {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: linear-gradient(180deg, #0F1F3F 0%, #1E3A6E 100%);
		color: white;
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		animation: fade-in 0.2s ease-out;
	}
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.vc-top {
		padding: 12px 16px;
		display: flex;
		justify-content: flex-end;
	}
	.vc-icon-btn {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.12);
		color: white;
		border: none;
		cursor: pointer;
	}
	.vc-icon-btn:active { background: rgba(255, 255, 255, 0.22); }

	.vc-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0 32px;
		gap: 24px;
	}

	.vc-blob-wrap {
		position: relative;
		width: 200px;
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.vc-blob { position: relative; width: 100%; height: 100%; }
	.vc-ring {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		opacity: 0;
	}
	.vc-core {
		position: absolute;
		inset: 30px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.95);
		color: #1E3A6E;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.5);
		transition: background 0.3s ease, color 0.3s ease;
	}

	.vc-blob.listening .vc-core { background: #FF453A; color: white; }
	.vc-blob.listening .vc-ring {
		background: rgba(255, 69, 58, 0.35);
		animation: ripple 1.4s ease-out infinite;
	}
	.vc-blob.listening .r2 { animation-delay: 0.45s; }
	.vc-blob.listening .r3 { animation-delay: 0.9s; }

	.vc-blob.thinking .vc-core {
		background: #FFCC00; color: #1E3A6E;
		animation: pulse-soft 1.6s ease-in-out infinite;
	}

	.vc-blob.speaking .vc-core { background: rgba(255, 255, 255, 0.95); color: #1E3A6E; }
	.vc-blob.speaking .vc-ring {
		background: rgba(255, 255, 255, 0.18);
		animation: ripple 2s ease-out infinite;
	}
	.vc-blob.speaking .r2 { animation-delay: 0.6s; }
	.vc-blob.speaking .r3 { animation-delay: 1.2s; }

	.vc-blob.paused .vc-core,
	.vc-blob.idle .vc-core,
	.vc-blob.error .vc-core { background: rgba(255, 255, 255, 0.4); color: white; }

	@keyframes ripple {
		0%   { transform: scale(0.8); opacity: 0.7; }
		100% { transform: scale(1.6); opacity: 0; }
	}
	@keyframes pulse-soft {
		0%, 100% { transform: scale(1); }
		50%      { transform: scale(0.95); }
	}

	.vc-state-label {
		font-size: 22px;
		font-weight: 600;
		margin: 0;
		text-align: center;
	}

	.vc-user-text {
		font-size: 17px;
		opacity: 0.85;
		text-align: center;
		max-width: 380px;
		line-height: 1.4;
		font-style: italic;
		margin: 0;
	}
	.vc-ai-text {
		font-size: 17px;
		text-align: center;
		max-width: 420px;
		line-height: 1.45;
		opacity: 0.95;
		margin: 0;
	}
	.vc-error-text {
		font-size: 15px;
		text-align: center;
		max-width: 320px;
		color: #FFB4B4;
		line-height: 1.4;
		margin: 0;
	}

	.vc-bottom {
		padding: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.vc-pause-btn {
		width: 64px;
		height: 64px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.25);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.1s ease, background 0.15s ease;
	}
	.vc-pause-btn:active { transform: scale(0.94); }
	.vc-pause-btn.paused {
		background: white;
		color: #1E3A6E;
	}
	.vc-hint {
		font-size: 13px;
		opacity: 0.7;
		margin: 0;
		text-align: center;
	}
</style>
