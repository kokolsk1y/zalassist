<script>
	import { base } from "$app/paths";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import { loadCatalog, getCatalogDate } from "$lib/data/catalog.js";
	import { Search, MessageSquare, Zap, Lightbulb, Plug, Wrench, Cable, Shield } from "lucide-svelte";

	let catalogDate = $state("...");
	let catalogCount = $state(0);
	let searchInput = $state("");
	let placeholderIndex = $state(0);

	const placeholders = [
		"Автомат 25А...",
		"Кабель ВВГнг 3x2.5...",
		"Розетка Legrand...",
		"УЗО 40А 30мА...",
		"Светильник LED...",
		"Гофра 20мм...",
	];

	const categories = [
		{ label: "Автоматика", icon: Shield, query: "Автоматика и Щиты" },
		{ label: "Кабель", icon: Cable, query: "Кабель и провод" },
		{ label: "Освещение", icon: Lightbulb, query: "Лампы" },
		{ label: "Розетки", icon: Plug, query: "Розетки и выключатели" },
		{ label: "Инструмент", icon: Wrench, query: "Инструмент ручной" },
		{ label: "Монтаж", icon: Zap, query: "Электромонтаж" },
	];

	function getGreeting() {
		const hour = new Date().getHours();
		if (hour < 6) return "Доброй ночи!";
		if (hour < 12) return "Доброе утро!";
		if (hour < 18) return "Добрый день!";
		return "Добрый вечер!";
	}

	let greeting = $state(getGreeting());

	onMount(async () => {
		try {
			const catalog = await loadCatalog();
			catalogDate = getCatalogDate();
			catalogCount = catalog.items.length;
		} catch (e) {
			catalogDate = "ошибка загрузки";
		}

		// Rotating placeholder
		const interval = setInterval(() => {
			placeholderIndex = (placeholderIndex + 1) % placeholders.length;
		}, 3000);
		return () => clearInterval(interval);
	});

	const CHAT_KEYWORDS = ["хочу", "нужно", "сделать", "помоги", "подобрать", "посоветуй", "как ", "что нужно", "проводка", "ремонт", "установ"];

	function looksLikeTask(text) {
		const lower = text.toLowerCase();
		return CHAT_KEYWORDS.some(kw => lower.includes(kw));
	}

	function handleSearch(e) {
		e.preventDefault();
		const q = searchInput.trim();
		if (!q) return;
		if (looksLikeTask(q)) {
			goto(`${base}/chat/`, { state: { initialMessage: q } });
		} else {
			goto(`${base}/search/?q=${encodeURIComponent(q)}`);
		}
	}
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center px-4 pt-8 pb-8">
	<!-- Лого -->
	<div class="mb-6 text-center">
		<img src="{base}/logo.png" alt="ЭлектроЦентр" width="443" height="99" class="h-10 w-auto mx-auto mb-2 rounded-lg bg-white px-3 py-1 shadow-sm" />
		<p class="text-sm text-base-content/70">Помощник в торговом зале</p>
	</div>

	<!-- Greeting -->
	<h2 class="text-2xl font-bold text-base-content mb-6 text-center">
		{greeting}
	</h2>

	<!-- Поле ввода с rotating placeholder -->
	<form onsubmit={handleSearch} class="w-full max-w-md mb-6">
		<div class="relative">
			<input
				type="text"
				bind:value={searchInput}
				placeholder={placeholders[placeholderIndex]}
				class="input input-bordered input-lg w-full bg-base-100 shadow-md focus:border-primary focus:shadow-lg transition-all pr-14 text-base"
			/>
			{#if searchInput.trim()}
				<button
					type="submit"
					class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-primary btn-circle min-h-[40px] min-w-[40px]"
					aria-label="Искать"
				>
					<Search size={20} />
				</button>
			{/if}
		</div>
	</form>

	<!-- Категории — визуальная сетка -->
	<div class="w-full max-w-md grid grid-cols-3 gap-3 mb-2">
		{#each categories as cat}
			<button
				onclick={() => goto(`${base}/search/?category=${encodeURIComponent(cat.query)}`)}
				class="flex flex-col items-center gap-2 p-4 bg-base-100 rounded-xl shadow-sm active:scale-[0.97] transition-transform min-h-[80px]"
			>
				<cat.icon size={24} class="text-primary" />
				<span class="text-sm font-medium text-base-content">{cat.label}</span>
			</button>
		{/each}
	</div>

	<button
		onclick={() => goto(`${base}/search/`)}
		class="w-full max-w-md btn btn-ghost text-primary mb-6 min-h-[44px]"
	>
		Все категории →
	</button>

	<!-- AI блок -->
	<button
		onclick={() => goto(`${base}/chat/`)}
		class="w-full max-w-md bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform mb-6"
	>
		<img src="{base}/ai-avatar.png" alt="AI" class="w-12 h-12 rounded-full bg-white p-1 shadow-sm" />
		<div class="text-left">
			<p class="font-semibold text-base-content">Не знаете что нужно?</p>
			<p class="text-sm text-base-content/60">Опишите задачу — подберём товары</p>
		</div>
	</button>

	<!-- Статус каталога -->
	<p class="text-xs text-base-content/50 mt-auto pt-4 flex items-center gap-1.5">
		<span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
		{catalogCount > 0 ? `${catalogCount.toLocaleString("ru-RU")} товаров` : ""}
		{#if catalogDate !== "..."} · обновлено {catalogDate}{/if}
	</p>
</div>
