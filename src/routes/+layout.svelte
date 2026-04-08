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
	});
</script>

<svelte:head>
	<title>ЭлектроЦентр — Помощник в торговом зале</title>
	<meta name="description" content="Подбор электротехнических товаров, поиск по артикулу, готовые комплекты" />
	<meta name="theme-color" content="#1E3A6E" />
</svelte:head>

<main class="pb-nav">
	{@render children()}
</main>

<BottomNav oncartclick={() => showCart = true} />
<CartPanel open={showCart} onclose={() => showCart = false} />
<InstallPrompt />
<Toast />
