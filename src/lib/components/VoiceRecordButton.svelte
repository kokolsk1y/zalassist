<script>
	import { Mic, ChevronLeft, Trash2 } from "lucide-svelte";
	import { recognizeStream, isRecognitionSupported } from "$lib/ai/recognize.js";
	import * as haptics from "$lib/utils/haptics.js";
	import { onDestroy } from "svelte";

	// Push-to-hold кнопка записи в стиле Telegram-голосовых:
	// - Зажал — записывается, видишь промежуточный текст
	// - Отпустил — отправляется
	// - Свайп влево за порог — отмена записи (полоска "← Отмена")
	//
	// Колбэк: onresult(text) — финальный текст после отпускания.
	// Если свайп-отмена или ошибка — onresult НЕ вызывается.

	let { onresult, size = 56, disabled = false } = $props();

	const supported = isRecognitionSupported();

	let recording = $state(false);
	let cancelling = $state(false); // показываем красное "Отпустите для отмены"
	let dx = $state(0); // смещение пальца влево (отрицательное)
	let partialText = $state("");
	let elapsed = $state(0);
	let session = null;
	let startX = 0;
	let timer = null;
	let startTime = 0;
	let errorMsg = $state("");

	const CANCEL_THRESHOLD = 80; // px — за этот порог свайп = отмена
	const MIN_RECORD_MS = 300; // короче — считаем случайным тапом

	function pointerDown(e) {
		if (!supported || disabled || recording) return;
		e.preventDefault();
		startX = e.clientX;
		startRecording();
	}

	function pointerMove(e) {
		if (!recording) return;
		const delta = e.clientX - startX;
		if (delta < 0) {
			dx = delta;
			cancelling = -delta >= CANCEL_THRESHOLD;
		} else {
			dx = 0;
			cancelling = false;
		}
	}

	function pointerUp() {
		if (!recording) return;
		if (cancelling) {
			doCancel();
		} else {
			doFinalize();
		}
	}

	function startRecording() {
		errorMsg = "";
		partialText = "";
		dx = 0;
		cancelling = false;
		elapsed = 0;
		recording = true;
		haptics.tap();
		startTime = Date.now();
		timer = setInterval(() => { elapsed = Date.now() - startTime; }, 100);

		session = recognizeStream({
			onPartial: (text) => { partialText = text; },
			onError: (err) => {
				if (err === "not-allowed") errorMsg = "Микрофон запрещён в настройках браузера";
				else if (err === "audio-capture") errorMsg = "Микрофон не найден";
				else if (err === "network") errorMsg = "Нет сети для распознавания";
				else errorMsg = "Ошибка микрофона";
			},
		});
	}

	async function doFinalize() {
		const recordedMs = Date.now() - startTime;
		recording = false;
		clearInterval(timer);
		const result = await session?.finalize();
		session = null;

		if (recordedMs < MIN_RECORD_MS) {
			// Случайный тап — игнорируем
			haptics.error();
			errorMsg = "Удерживайте кнопку для записи";
			setTimeout(() => { errorMsg = ""; }, 1500);
			return;
		}

		if (result && result.trim()) {
			haptics.success();
			onresult?.(result.trim());
		} else if (!errorMsg) {
			haptics.error();
			errorMsg = "Не услышали — попробуйте ещё раз";
			setTimeout(() => { errorMsg = ""; }, 2000);
		}
		partialText = "";
	}

	function doCancel() {
		recording = false;
		clearInterval(timer);
		session?.cancel();
		session = null;
		haptics.tap();
		partialText = "";
		dx = 0;
		cancelling = false;
	}

	function fmtTime(ms) {
		const s = Math.floor(ms / 1000);
		const mm = String(Math.floor(s / 60)).padStart(2, "0");
		const ss = String(s % 60).padStart(2, "0");
		return `${mm}:${ss}`;
	}

	onDestroy(() => {
		clearInterval(timer);
		session?.cancel();
	});
</script>

{#if supported}
	<div class="vr-wrap">
		{#if recording}
			<!-- Полоса записи на ширину панели: таймер + interim текст + подсказка "← отмена" -->
			<div class="vr-bar" class:cancelling>
				{#if cancelling}
					<span class="vr-cancel-hint">
						<Trash2 size={18} /> Отпустите для отмены
					</span>
				{:else}
					<span class="vr-dot"></span>
					<span class="vr-time">{fmtTime(elapsed)}</span>
					<span class="vr-text">
						{partialText || "Слушаю…"}
					</span>
					<span class="vr-slide-hint">
						<ChevronLeft size={14} /> Влево — отмена
					</span>
				{/if}
			</div>
		{:else if errorMsg}
			<div class="vr-error">{errorMsg}</div>
		{/if}

		<button
			type="button"
			class="vr-btn"
			class:recording
			class:cancelling
			style:width="{size}px"
			style:height="{size}px"
			style:transform="translateX({dx}px) scale({recording ? 1.15 : 1})"
			onpointerdown={pointerDown}
			onpointermove={pointerMove}
			onpointerup={pointerUp}
			onpointercancel={pointerUp}
			onpointerleave={(e) => { if (recording && e.buttons === 0) pointerUp(); }}
			oncontextmenu={(e) => e.preventDefault()}
			aria-label={recording ? "Запись… отпустите для отправки, влево для отмены" : "Удерживайте для записи голоса"}
			{disabled}
		>
			<Mic size={size * 0.4} />
		</button>
	</div>
{/if}

<style>
	.vr-wrap {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vr-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: var(--color-primary);
		color: var(--color-primary-content);
		border: none;
		cursor: pointer;
		transition: transform 0.12s ease, background 0.15s ease;
		box-shadow: 0 4px 14px -4px color-mix(in oklch, var(--color-primary) 50%, transparent);
		-webkit-tap-highlight-color: transparent;
		touch-action: none;
		user-select: none;
	}
	.vr-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.vr-btn.recording {
		background: var(--color-error);
		box-shadow: 0 0 0 14px color-mix(in oklch, var(--color-error) 25%, transparent),
			0 0 0 28px color-mix(in oklch, var(--color-error) 12%, transparent);
		animation: pulse-rec 1.4s ease-in-out infinite;
	}
	.vr-btn.cancelling {
		background: var(--color-base-content);
		animation: none;
	}
	@keyframes pulse-rec {
		0%, 100% { box-shadow: 0 0 0 14px color-mix(in oklch, var(--color-error) 25%, transparent), 0 0 0 28px color-mix(in oklch, var(--color-error) 12%, transparent); }
		50%      { box-shadow: 0 0 0 22px color-mix(in oklch, var(--color-error) 18%, transparent), 0 0 0 40px color-mix(in oklch, var(--color-error) 6%, transparent); }
	}

	/* Плашка во время записи — занимает всю ширину контейнера */
	.vr-bar {
		position: absolute;
		bottom: calc(100% + 8px);
		right: -8px;
		left: auto;
		min-width: 280px;
		max-width: calc(100vw - 32px);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: var(--color-base-100);
		border: 1px solid var(--color-base-300);
		border-radius: 14px;
		box-shadow: 0 8px 28px -8px rgba(0, 0, 0, 0.25);
		font-size: 13px;
		white-space: nowrap;
		overflow: hidden;
	}
	.vr-bar.cancelling {
		background: color-mix(in oklch, var(--color-error) 12%, var(--color-base-100));
		border-color: var(--color-error);
		color: var(--color-error);
	}
	.vr-dot {
		width: 9px;
		height: 9px;
		border-radius: 9999px;
		background: var(--color-error);
		flex-shrink: 0;
		animation: blink 1s ease-in-out infinite;
	}
	@keyframes blink {
		50% { opacity: 0.3; }
	}
	.vr-time {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		flex-shrink: 0;
	}
	.vr-text {
		flex: 1;
		text-overflow: ellipsis;
		overflow: hidden;
		opacity: 0.9;
	}
	.vr-slide-hint {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		opacity: 0.5;
		font-size: 11px;
		flex-shrink: 0;
	}
	.vr-cancel-hint {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
	}

	.vr-error {
		position: absolute;
		bottom: calc(100% + 8px);
		right: 0;
		min-width: 200px;
		padding: 8px 12px;
		background: var(--color-error);
		color: var(--color-error-content, white);
		border-radius: 10px;
		font-size: 12px;
		font-weight: 500;
		box-shadow: 0 4px 14px -4px rgba(0, 0, 0, 0.3);
	}
</style>
