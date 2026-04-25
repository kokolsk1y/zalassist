<script>
	import { onMount, onDestroy } from "svelte";
	import { X, Zap, ZapOff } from "lucide-svelte";
	import * as haptics from "$lib/utils/haptics.js";

	// Гибридный сканер: нативный BarcodeDetector API (Chrome Android, Edge),
	// fallback @zxing/library (iOS Safari и старые браузеры). zxing импортируется
	// динамически чтобы не утяжелять основной бандл.

	let { onresult, oncancel } = $props();

	let videoEl;
	let stream = $state(null);
	let error = $state("");
	let scanning = $state(true);
	let torchOn = $state(false);
	let torchSupported = $state(false);
	let zxingReader = null;
	let nativeDetector = null;
	let rafId = null;

	const FORMATS = ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a", "upc_e", "itf"];

	onMount(async () => {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: { ideal: "environment" },
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
				audio: false,
			});

			if (!videoEl) return;
			videoEl.srcObject = stream;
			await videoEl.play();

			// Проверяем поддержку фонарика на текущем стриме
			const track = stream.getVideoTracks()[0];
			const caps = track.getCapabilities?.() || {};
			torchSupported = !!caps.torch;

			// Выбираем движок
			if ("BarcodeDetector" in window) {
				nativeDetector = new window.BarcodeDetector({ formats: FORMATS });
				loopNative();
			} else {
				const { BrowserMultiFormatReader } = await import("@zxing/library");
				zxingReader = new BrowserMultiFormatReader();
				zxingReader.decodeFromVideoElement(videoEl, (result, err) => {
					if (!scanning) return;
					if (result) handleHit(result.getText());
				});
			}
		} catch (e) {
			if (e?.name === "NotAllowedError") {
				error = "Доступ к камере запрещён. Разрешите в настройках браузера.";
			} else if (e?.name === "NotFoundError") {
				error = "Камера не найдена.";
			} else {
				error = "Не удалось запустить камеру: " + (e?.message || e);
			}
		}
	});

	function loopNative() {
		if (!scanning || !nativeDetector || !videoEl) return;
		nativeDetector.detect(videoEl)
			.then(codes => {
				if (codes && codes.length > 0 && scanning) {
					handleHit(codes[0].rawValue);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (scanning) rafId = requestAnimationFrame(() => setTimeout(loopNative, 120));
			});
	}

	function handleHit(code) {
		if (!scanning || !code) return;
		scanning = false;
		haptics.success();
		onresult?.(code);
	}

	async function toggleTorch() {
		if (!stream || !torchSupported) return;
		const track = stream.getVideoTracks()[0];
		try {
			await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
			torchOn = !torchOn;
		} catch {}
	}

	function cancel() {
		haptics.tap();
		oncancel?.();
	}

	onDestroy(() => {
		scanning = false;
		if (rafId) cancelAnimationFrame(rafId);
		try { zxingReader?.reset?.(); } catch {}
		if (stream) stream.getTracks().forEach(t => t.stop());
	});
</script>

<div class="scanner-root">
	{#if error}
		<div class="scanner-error">
			<p class="text-lg font-semibold mb-2">Ошибка камеры</p>
			<p class="text-sm opacity-80 mb-6">{error}</p>
			<button class="btn btn-primary" onclick={cancel}>Закрыть</button>
		</div>
	{:else}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={videoEl} autoplay playsinline muted class="scanner-video"></video>

		<!-- Прицельная рамка с вырезом по центру -->
		<div class="scanner-overlay" aria-hidden="true">
			<div class="cutout">
				<span class="corner tl"></span>
				<span class="corner tr"></span>
				<span class="corner bl"></span>
				<span class="corner br"></span>
				<span class="laser"></span>
			</div>
		</div>

		<div class="scanner-hint">
			Наведите камеру на штрих-код упаковки
		</div>

		<button class="scanner-btn close" aria-label="Закрыть сканер" onclick={cancel}>
			<X size={24} />
		</button>

		{#if torchSupported}
			<button class="scanner-btn torch" aria-label="Фонарик" onclick={toggleTorch}>
				{#if torchOn}<Zap size={24} />{:else}<ZapOff size={24} />{/if}
			</button>
		{/if}
	{/if}
</div>

<style>
	.scanner-root {
		position: fixed;
		inset: 0;
		background: black;
		z-index: 100;
		overflow: hidden;
	}
	.scanner-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.scanner-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.cutout {
		position: relative;
		width: min(78vw, 320px);
		height: 220px;
		max-height: 35vh;
	}
	.corner {
		position: absolute;
		width: 28px;
		height: 28px;
		border-color: white;
		border-style: solid;
		border-width: 0;
	}
	.corner.tl { top: 0; left: 0; border-top-width: 4px; border-left-width: 4px; border-top-left-radius: 6px; }
	.corner.tr { top: 0; right: 0; border-top-width: 4px; border-right-width: 4px; border-top-right-radius: 6px; }
	.corner.bl { bottom: 0; left: 0; border-bottom-width: 4px; border-left-width: 4px; border-bottom-left-radius: 6px; }
	.corner.br { bottom: 0; right: 0; border-bottom-width: 4px; border-right-width: 4px; border-bottom-right-radius: 6px; }
	.laser {
		position: absolute;
		left: 8%; right: 8%;
		top: 50%;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(255,80,80,0.95), transparent);
		box-shadow: 0 0 12px rgba(255,80,80,0.85);
		animation: laser 1.6s ease-in-out infinite alternate;
	}
	@keyframes laser {
		from { transform: translateY(-80px); }
		to { transform: translateY(80px); }
	}
	.scanner-hint {
		position: absolute;
		left: 0; right: 0;
		bottom: max(48px, env(safe-area-inset-bottom));
		text-align: center;
		color: white;
		font-size: 14px;
		font-weight: 500;
		text-shadow: 0 1px 2px rgba(0,0,0,0.6);
		padding: 0 24px;
	}
	.scanner-btn {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 9999px;
		background: rgba(0,0,0,0.55);
		color: white;
		border: 1px solid rgba(255,255,255,0.15);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	.scanner-btn:active { transform: scale(0.94); }
	.scanner-btn.close {
		top: max(16px, env(safe-area-inset-top));
		right: 16px;
	}
	.scanner-btn.torch {
		top: max(16px, env(safe-area-inset-top));
		left: 16px;
	}
	.scanner-error {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		color: white;
		padding: 24px;
	}
</style>
