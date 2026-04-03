<script>
	import "../app.css";
	import { ShoppingCart } from "lucide-svelte";
	import { useCart } from "$lib/stores/cart.svelte.js";
	import Toast from "$lib/components/Toast.svelte";
	import CartPanel from "$lib/components/CartPanel.svelte";
	let { children } = $props();
	let showCart = $state(false);
	const cart = useCart();
</script>

<svelte:head>
	<title>ЭлектроЦентр — Помощник в торговом зале</title>
	<meta name="description" content="Подбор электротехнических товаров, поиск по артикулу, готовые комплекты" />
	<meta name="theme-color" content="#2b7de0" />
</svelte:head>

<main>
	{@render children()}
</main>

{#if cart.count > 0}
	<button
		class="fixed top-4 right-4 btn btn-primary btn-circle shadow-lg z-50"
		onclick={() => showCart = true}
		aria-label="Список товаров ({cart.count})"
	>
		<ShoppingCart size={20} />
		<span class="absolute -top-1 -right-1 badge badge-secondary badge-sm">{cart.count}</span>
	</button>
{/if}

<CartPanel open={showCart} onclose={() => showCart = false} />
<Toast />
