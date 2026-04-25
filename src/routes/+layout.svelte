<script>
	import "../app.css";
	import { onMount } from "svelte";
	import Toast from "$lib/components/Toast.svelte";
	import CartPanel from "$lib/components/CartPanel.svelte";
	import BottomNav from "$lib/components/BottomNav.svelte";
	import InstallPrompt from "$lib/components/InstallPrompt.svelte";
	import { useCart } from "$lib/stores/cart.svelte.js";
	let { children } = $props();
	let showCart = $state(false);
	let isStandalone = $state(true); // По умолчанию считаем standalone (не мешает разметке)
	let isIosChromeOrSafari = $state(false);
	const cart = useCart();

	onMount(() => {
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
		return () => {
			document.removeEventListener("focusin", onFocusIn);
			document.removeEventListener("focusout", onFocusOut);
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
<Toast />
