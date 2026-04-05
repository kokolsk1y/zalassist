<script>
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import { Home, Search, MessageSquare, ClipboardList } from "lucide-svelte";
	import { useCart } from "$lib/stores/cart.svelte.js";

	let { oncartclick } = $props();
	const cart = useCart();

	const tabs = [
		{ href: `${base}/`, icon: Home, label: "Главная", match: /^\/$|^\/zalassist\/?$/ },
		{ href: `${base}/search/`, icon: Search, label: "Поиск", match: /\/search/ },
		{ href: `${base}/chat/`, icon: MessageSquare, label: "AI", match: /\/chat/ },
	];

	function isActive(tab) {
		return tab.match.test(page.url?.pathname || "");
	}
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-primary text-primary-content z-50 flex safe-bottom">
	{#each tabs as tab}
		<a
			href={tab.href}
			class="flex-1 flex flex-col items-center justify-center min-h-[56px] transition-opacity"
			class:opacity-100={isActive(tab)}
			class:opacity-60={!isActive(tab)}
		>
			<tab.icon size={22} />
			<span class="text-[11px] mt-0.5">{tab.label}</span>
		</a>
	{/each}

	<button
		class="flex-1 flex flex-col items-center justify-center min-h-[56px] opacity-60 hover:opacity-100 transition-opacity"
		onclick={() => oncartclick?.()}
	>
		<div class="relative">
			<ClipboardList size={22} />
			{#if cart.count > 0}
				<span class="absolute -top-2 -right-3 bg-secondary text-secondary-content rounded-full text-[10px] min-w-[18px] h-[18px] flex items-center justify-center font-bold">
					{cart.count}
				</span>
			{/if}
		</div>
		<span class="text-[11px] mt-0.5">Список</span>
	</button>
</nav>
