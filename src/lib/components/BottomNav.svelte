<script>
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import { Home, Search, MessageSquare, ClipboardList, ScanLine } from "lucide-svelte";
	import { useCart } from "$lib/stores/cart.svelte.js";
	import * as haptics from "$lib/utils/haptics.js";

	let { oncartclick, cartActive = false } = $props();
	const cart = useCart();

	const left = [
		{ href: `${base}/`, icon: Home, label: "Главная", match: /^\/$|^\/zalassist\/?$/ },
		{ href: `${base}/search/`, icon: Search, label: "Поиск", match: /\/search/ },
	];
	const right = [
		{ href: `${base}/chat/`, icon: MessageSquare, label: "AI", match: /\/chat/ },
	];

	function isActive(tab) {
		if (cartActive) return false;
		return tab.match.test(page.url?.pathname || "");
	}
</script>

<nav class="bottom-nav fixed bottom-0 left-0 right-0 bg-primary text-primary-content z-50">
	<div class="flex items-stretch">
		{#each left as tab}
			<a
				href={tab.href}
				class="tab-item"
				class:tab-active={isActive(tab)}
				onclick={() => haptics.tap()}
			>
				<span class="tab-indicator" aria-hidden="true"></span>
				<tab.icon size={22} strokeWidth={isActive(tab) ? 2.4 : 2} />
				<span class="tab-label">{tab.label}</span>
			</a>
		{/each}

		<!-- Приподнятая центральная кнопка-сканер: главное действие в зале -->
		<a
			href="{base}/scan/"
			class="scan-fab"
			aria-label="Сканировать штрих-код"
			onclick={() => haptics.tap()}
		>
			<ScanLine size={26} strokeWidth={2.4} />
		</a>

		{#each right as tab}
			<a
				href={tab.href}
				class="tab-item"
				class:tab-active={isActive(tab)}
				onclick={() => haptics.tap()}
			>
				<span class="tab-indicator" aria-hidden="true"></span>
				<tab.icon size={22} strokeWidth={isActive(tab) ? 2.4 : 2} />
				<span class="tab-label">{tab.label}</span>
			</a>
		{/each}

		<button
			type="button"
			class="tab-item"
			class:tab-active={cartActive}
			aria-label="Список для менеджера"
			onclick={() => { haptics.tap(); oncartclick?.(); }}
		>
			<span class="tab-indicator" aria-hidden="true"></span>
			<span class="relative">
				<ClipboardList size={22} strokeWidth={cartActive ? 2.4 : 2} />
				{#if cart.count > 0}
					<span class="cart-badge">{cart.count > 99 ? "99+" : cart.count}</span>
				{/if}
			</span>
			<span class="tab-label">Список</span>
		</button>
	</div>
	<!-- Безопасная зона iPhone home indicator: фон рисуется, кликов нет -->
	<div class="safe-pad" aria-hidden="true"></div>
</nav>

<style>
	.bottom-nav {
		border-top: 1px solid color-mix(in oklch, var(--color-primary-content) 12%, transparent);
		box-shadow: 0 -8px 24px -12px rgba(0, 0, 0, 0.25), 0 -1px 0 rgba(0, 0, 0, 0.08);
	}

	.tab-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		min-height: 56px;
		padding: 6px 4px 8px;
		color: inherit;
		opacity: 0.6;
		transition: opacity 0.15s ease, transform 0.1s ease;
		text-decoration: none;
		position: relative;
		-webkit-tap-highlight-color: transparent;
	}

	.tab-item:active {
		transform: scale(0.94);
	}

	.tab-active {
		opacity: 1;
	}

	/* Точка-индикатор активной вкладки под подписью */
	.tab-indicator {
		position: absolute;
		top: 4px;
		left: 50%;
		transform: translateX(-50%);
		width: 22px;
		height: 3px;
		border-radius: 2px;
		background: currentColor;
		opacity: 0;
		transition: opacity 0.18s ease;
	}

	.tab-active .tab-indicator {
		opacity: 1;
	}

	.tab-label {
		font-size: 11px;
		line-height: 1;
		letter-spacing: 0.01em;
		font-weight: 500;
	}

	.scan-fab {
		flex: 0 0 auto;
		width: 56px;
		height: 56px;
		margin: -16px 6px 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: var(--color-secondary);
		color: var(--color-secondary-content);
		box-shadow: 0 6px 18px -2px rgba(0, 0, 0, 0.35), 0 0 0 4px var(--color-primary);
		text-decoration: none;
		transition: transform 0.1s ease;
		-webkit-tap-highlight-color: transparent;
	}
	.scan-fab:active {
		transform: scale(0.92);
	}

	.cart-badge {
		position: absolute;
		top: -8px;
		right: -10px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9999px;
		background: var(--color-secondary);
		color: var(--color-secondary-content);
		font-size: 10px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.safe-pad {
		height: env(safe-area-inset-bottom, 0px);
		background: inherit;
		pointer-events: none;
	}
</style>
