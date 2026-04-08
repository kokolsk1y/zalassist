<script>
	import { onMount } from "svelte";
	import { Download, X, Share } from "lucide-svelte";

	let deferredPrompt = $state(null);
	let showAndroidPrompt = $state(false);
	let showIosHint = $state(false);
	let dismissed = $state(false);

	const DISMISS_KEY = "zalassist-install-dismissed";
	const DISMISS_DAYS = 7;

	function isDismissedRecently() {
		try {
			const raw = localStorage.getItem(DISMISS_KEY);
			if (!raw) return false;
			const ts = parseInt(raw);
			if (!ts) return false;
			const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
			return days < DISMISS_DAYS;
		} catch { return false; }
	}

	function setDismissed() {
		try { localStorage.setItem(DISMISS_KEY, Date.now().toString()); } catch {}
		dismissed = true;
		showAndroidPrompt = false;
		showIosHint = false;
	}

	function isStandalone() {
		if (typeof window === "undefined") return false;
		return window.matchMedia("(display-mode: standalone)").matches
			|| window.navigator.standalone === true;
	}

	function isIosSafari() {
		if (typeof navigator === "undefined") return false;
		const ua = navigator.userAgent;
		const isIOS = /iPhone|iPad|iPod/.test(ua);
		const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
		return isIOS && isSafari;
	}

	async function installApp() {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted" || outcome === "dismissed") {
			deferredPrompt = null;
			showAndroidPrompt = false;
			if (outcome === "dismissed") setDismissed();
		}
	}

	onMount(() => {
		if (isStandalone() || isDismissedRecently()) return;

		// Android / Chrome — ловим событие
		const handler = (e) => {
			e.preventDefault();
			deferredPrompt = e;
			// Показываем через 5 секунд — не сразу при входе
			setTimeout(() => {
				if (!dismissed && !isStandalone()) showAndroidPrompt = true;
			}, 5000);
		};
		window.addEventListener("beforeinstallprompt", handler);

		// iOS — показываем инструкцию через 10 секунд после входа
		if (isIosSafari()) {
			setTimeout(() => {
				if (!dismissed && !isStandalone()) showIosHint = true;
			}, 10000);
		}

		window.addEventListener("appinstalled", () => {
			showAndroidPrompt = false;
			showIosHint = false;
		});

		return () => {
			window.removeEventListener("beforeinstallprompt", handler);
		};
	});
</script>

{#if showAndroidPrompt && deferredPrompt}
	<div class="fixed bottom-20 left-4 right-4 bg-base-100 rounded-xl shadow-2xl border border-base-300 p-4 z-[60] max-w-md mx-auto animate-in-up">
		<div class="flex items-start gap-3">
			<div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
				<Download size={24} class="text-primary" />
			</div>
			<div class="flex-1 min-w-0">
				<p class="font-semibold text-base-content">Установить на телефон</p>
				<p class="text-sm text-base-content/60 mt-0.5">Быстрый доступ с главного экрана</p>
			</div>
			<button class="btn btn-ghost btn-sm btn-circle shrink-0" onclick={setDismissed} aria-label="Закрыть">
				<X size={18} />
			</button>
		</div>
		<button class="btn btn-primary w-full mt-3 min-h-[44px]" onclick={installApp}>
			Установить
		</button>
	</div>
{/if}

{#if showIosHint}
	<div class="fixed bottom-20 left-4 right-4 bg-base-100 rounded-xl shadow-2xl border border-base-300 p-4 z-[60] max-w-md mx-auto animate-in-up">
		<div class="flex items-start gap-3">
			<div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
				<Share size={24} class="text-primary" />
			</div>
			<div class="flex-1 min-w-0">
				<p class="font-semibold text-base-content">Добавить на главный экран</p>
				<p class="text-sm text-base-content/60 mt-0.5">Нажмите <Share size={14} class="inline" /> внизу Safari → «На экран Домой»</p>
			</div>
			<button class="btn btn-ghost btn-sm btn-circle shrink-0" onclick={setDismissed} aria-label="Закрыть">
				<X size={18} />
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes in-up {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.animate-in-up {
		animation: in-up 0.3s ease-out;
	}
</style>
