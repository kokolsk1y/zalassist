<script>
	import { onMount } from "svelte";
	import { Download, X, Share } from "lucide-svelte";

	let deferredPrompt = $state(null);
	let showAndroidPrompt = $state(false);
	let showIosModal = $state(false);
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
		showIosModal = false;
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
			setTimeout(() => {
				if (!dismissed && !isStandalone()) showAndroidPrompt = true;
			}, 5000);
		};
		window.addEventListener("beforeinstallprompt", handler);

		// iOS Safari — показываем модалку через 15 сек (даём время поиграться)
		if (isIosSafari()) {
			setTimeout(() => {
				if (!dismissed && !isStandalone()) showIosModal = true;
			}, 15000);
		}

		window.addEventListener("appinstalled", () => {
			showAndroidPrompt = false;
			showIosModal = false;
		});

		return () => {
			window.removeEventListener("beforeinstallprompt", handler);
		};
	});
</script>

{#if showAndroidPrompt && deferredPrompt}
	<div class="fixed bottom-above-nav left-4 right-4 bg-base-100 rounded-xl shadow-2xl border border-base-300 p-4 z-[60] max-w-md mx-auto animate-in-up">
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

{#if showIosModal}
	<div class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 animate-in-fade">
		<button
			type="button"
			class="absolute inset-0 bg-black/60 cursor-default"
			onclick={setDismissed}
			aria-label="Закрыть инструкцию"
		></button>

		<div class="relative bg-base-100 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in-up">
			<button
				class="absolute right-3 top-3 btn btn-ghost btn-sm btn-circle"
				onclick={setDismissed}
				aria-label="Закрыть"
			>
				<X size={18} />
			</button>

			<div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
				<img src="pwa-192x192.png" alt="ЭлектроЦентр" class="w-10 h-10 rounded-xl" />
			</div>

			<h3 class="font-bold text-lg mb-1">Установите приложение</h3>
			<p class="text-sm text-base-content/60 mb-5">
				Добавьте на главный экран — быстрый доступ без браузера
			</p>

			<ol class="space-y-3 mb-5">
				<li class="flex items-start gap-3">
					<div class="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold shrink-0">1</div>
					<p class="text-sm pt-1">
						Нажмите
						<span class="inline-flex items-center gap-1 font-semibold text-primary">
							<Share size={14} /> Поделиться
						</span>
						внизу Safari
					</p>
				</li>
				<li class="flex items-start gap-3">
					<div class="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold shrink-0">2</div>
					<p class="text-sm pt-1">
						Выберите
						<span class="font-semibold text-primary">«На экран Домой»</span>
					</p>
				</li>
				<li class="flex items-start gap-3">
					<div class="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold shrink-0">3</div>
					<p class="text-sm pt-1">
						Нажмите
						<span class="font-semibold text-primary">«Добавить»</span>
					</p>
				</li>
			</ol>

			<button class="btn btn-primary btn-block min-h-[44px]" onclick={setDismissed}>
				Понятно
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes in-up {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@keyframes in-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.animate-in-up {
		animation: in-up 0.3s ease-out;
	}
	.animate-in-fade {
		animation: in-fade 0.2s ease-out;
	}
</style>
