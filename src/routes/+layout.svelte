<script>
	import "../app.css";
	import { base } from "$app/paths";
	import { goto, onNavigate } from "$app/navigation";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import Toast from "$lib/components/Toast.svelte";
	import CartPanel from "$lib/components/CartPanel.svelte";
	import BottomNav from "$lib/components/BottomNav.svelte";
	import InstallPrompt from "$lib/components/InstallPrompt.svelte";
	import Onboarding from "$lib/components/Onboarding.svelte";
	import { useCart } from "$lib/stores/cart.svelte.js";
	import { attachSwipeNav } from "$lib/utils/swipe-nav.js";
	import { applyTheme, watchSystemTheme } from "$lib/utils/theme.js";
	let { children } = $props();
	let showCart = $state(false);
	let isStandalone = $state(true); // По умолчанию считаем standalone (не мешает разметке)
	let isIosChromeOrSafari = $state(false);
	const cart = useCart();

	// Свайп-навигация: горизонтальный список основных разделов в порядке табов.
	// Свайп влево → следующий, свайп вправо → предыдущий. Кэш-скан и модалки исключены.
	const SWIPE_TABS = [`${base}/`, `${base}/search/`, `${base}/chat/`];
	let swipeDirection = $state("none"); // "left" | "right" | "none" — для View Transitions

	function currentTabIndex() {
		const path = page.url?.pathname || "";
		// Главная — точное совпадение или /zalassist/ для prod
		if (path === SWIPE_TABS[0] || path === `${base}` || path === "/" || path === `${base}/`) return 0;
		if (path.startsWith(`${base}/search`)) return 1;
		if (path.startsWith(`${base}/chat`)) return 2;
		return -1; // не на одном из основных табов
	}

	function navigateTab(delta) {
		const idx = currentTabIndex();
		if (idx < 0) return;
		const next = idx + delta;
		if (next < 0 || next >= SWIPE_TABS.length) return;
		swipeDirection = delta > 0 ? "left" : "right";
		goto(SWIPE_TABS[next]);
	}

	// View Transitions: при наличии API запускаем плавный slide.
	// На Safari < 18 / Firefox / старых Chrome — fallback fade через CSS.
	onNavigate((navigation) => {
		if (typeof document === "undefined") return;
		// Меняем класс на html для slide-направления (CSS-переменные подставят подходящую анимацию)
		document.documentElement.dataset.viewTransitionDirection = swipeDirection;
		// Сбрасываем после короткой задержки, чтобы внешние клики возвращались к "none"
		setTimeout(() => { swipeDirection = "none"; }, 350);

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
		isStandalone = standalone;

		const ua = navigator.userAgent;
		const isIOS = /iPhone|iPad|iPod/.test(ua);
		isIosChromeOrSafari = isIOS && !standalone;

		// Добавляем класс на <html> для глобальных стилей
		if (isIosChromeOrSafari) {
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

		// Свайп-навигация между разделами — работает везде через Pointer Events.
		const detachSwipe = attachSwipeNav({
			onLeft: () => navigateTab(+1),  // палец влево = следующий таб
			onRight: () => navigateTab(-1), // палец вправо = предыдущий
			isAllowed: () => currentTabIndex() >= 0, // только когда на одном из табов
		});

		return () => {
			document.removeEventListener("focusin", onFocusIn);
			document.removeEventListener("focusout", onFocusOut);
			detachSwipe();
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
