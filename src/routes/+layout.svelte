<script>
	import "../app.css";
	import { onNavigate } from "$app/navigation";
	import { onMount } from "svelte";
	import Toast from "$lib/components/Toast.svelte";
	import CartPanel from "$lib/components/CartPanel.svelte";
	import BottomNav from "$lib/components/BottomNav.svelte";
	import InstallPrompt from "$lib/components/InstallPrompt.svelte";
	import Onboarding from "$lib/components/Onboarding.svelte";
	import { useCart } from "$lib/stores/cart.svelte.js";
	import { applyTheme, watchSystemTheme } from "$lib/utils/theme.js";
	let { children } = $props();
	let showCart = $state(false);
	const cart = useCart();

	// View Transitions: плавный fade при переходе между табами через тап.
	// На Safari < 18 / Firefox / старых Chrome — fallback без анимации.
	onNavigate((navigation) => {
		if (typeof document === "undefined") return;
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	onMount(() => {
		// Тема — сразу применяем сохранённый выбор, потом слушаем системные изменения
		applyTheme();
		const detachTheme = watchSystemTheme();

		const standalone = window.matchMedia("(display-mode: standalone)").matches
			|| window.navigator.standalone === true;

		const ua = navigator.userAgent;
		const isIOS = /iPhone|iPad|iPod/.test(ua);
		const isIosBrowser = isIOS && !standalone;

		// Добавляем класс на <html> для глобальных стилей
		if (isIosBrowser) {
			document.documentElement.classList.add("ios-browser");
		}
		if (standalone) {
			document.documentElement.classList.add("pwa-standalone");
		}

		// Прячем BottomNav при появлении клавиатуры — иначе он перекрывает
		// поле ввода на Android Chrome (viewport уменьшается, fixed bottom прилипает к клавиатуре).
		const onFocusIn = (e) => {
			const t = e.target;
			if (t && t.matches && t.matches("input, textarea, [contenteditable=true]")) {
				document.body.classList.add("kb-open");
			}
		};
		const onFocusOut = (e) => {
			const t = e.target;
			if (t && t.matches && t.matches("input, textarea, [contenteditable=true]")) {
				document.body.classList.remove("kb-open");
			}
		};
		document.addEventListener("focusin", onFocusIn);
		document.addEventListener("focusout", onFocusOut);

		// Открытие корзины через CustomEvent (тап по toast «Добавлено» → «Открыть»)
		const onOpenCart = () => { showCart = true; };
		window.addEventListener("zalassist:open-cart", onOpenCart);

		return () => {
			document.removeEventListener("focusin", onFocusIn);
			document.removeEventListener("focusout", onFocusOut);
			window.removeEventListener("zalassist:open-cart", onOpenCart);
			detachTheme();
		};
	});
</script>

<svelte:head>
	<title>ЭлектроЦентр — Помощник в торговом зале</title>
	<meta name="description" content="Подбор электротехнических товаров, поиск по артикулу, готовые комплекты" />
	<meta name="theme-color" content="#1E3A6E" />
</svelte:head>

<main class="flex-1 flex flex-col">
	{@render children()}
</main>

<BottomNav oncartclick={() => showCart = true} cartActive={showCart} />
<CartPanel open={showCart} onclose={() => showCart = false} />
<InstallPrompt />
<Onboarding />
<Toast />
