<script>
	import "../app.css";
	import Toast from "$lib/components/Toast.svelte";
	import CartPanel from "$lib/components/CartPanel.svelte";
	import BottomNav from "$lib/components/BottomNav.svelte";
	import InstallPrompt from "$lib/components/InstallPrompt.svelte";
	import { useCart } from "$lib/stores/cart.svelte.js";
	let { children } = $props();
	let showCart = $state(false);
	const cart = useCart();
</script>

<svelte:head>
	<title>ЭлектроЦентр — Помощник в торговом зале</title>
	<meta name="description" content="Подбор электротехнических товаров, поиск по артикулу, готовые комплекты" />
	<meta name="theme-color" content="#1E3A6E" />
</svelte:head>

<main class="pb-16">
	{@render children()}
</main>

<BottomNav oncartclick={() => showCart = true} />
<CartPanel open={showCart} onclose={() => showCart = false} />
<InstallPrompt />
<Toast />
