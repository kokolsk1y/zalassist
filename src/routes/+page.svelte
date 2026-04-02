<script>
	import { base } from "$app/paths";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import { loadCatalog, getCatalogDate } from "$lib/data/catalog.js";
	import { Search, MessageSquare, Package } from "lucide-svelte";

	let catalogDate = $state("...");
	let catalogCount = $state(0);
	let searchInput = $state("");

	const chips = [
		{ label: "Автоматы", category: "Автоматы" },
		{ label: "Кабель", category: "Кабель" },
		{ label: "Розетки", category: "Розетки" },
		{ label: "Щиты", category: "Щиты" },
		{ label: "Освещение", category: "Освещение" },
		{ label: "УЗО", category: "УЗО" },
		{ label: "АВДТ", category: "АВДТ" },
		{ label: "Каналы", category: "Каналы" },
	];

	onMount(async () => {
		try {
			const catalog = await loadCatalog();
			catalogDate = getCatalogDate();
			catalogCount = catalog.items.length;
		} catch (e) {
			catalogDate = "ошибка загрузки";
			console.error("Catalog load failed:", e);
		}
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
			// Похоже на задачу → в чат
			goto(`${base}/chat/`, { state: { initialMessage: q } });
		} else {
			goto(`${base}/search/?q=${encodeURIComponent(q)}`);
		}
	}
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center px-4 pt-12 pb-8">
	<!-- Лого -->
	<div class="mb-8 text-center">
		<img src="{base}/logo.png" alt="ЭлектроЦентр" class="h-10 mx-auto mb-2" />
		<p class="text-sm text-base-content/60">Помощник в торговом зале</p>
	</div>

	<!-- Hero -->
	<h2 class="text-3xl font-bold text-base-content mb-6 text-center">
		Что будем делать?
	</h2>

	<!-- Поле ввода -->
	<form onsubmit={handleSearch} class="w-full max-w-md mb-6">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Артикул, название или задача..."
			class="input input-bordered input-lg w-full bg-base-100 shadow-md focus:border-primary focus:shadow-lg transition-all"
		/>
	</form>

	<!-- 3 CTA -->
	<div class="w-full max-w-md flex flex-col gap-3">
		<a href="{base}/search/" class="btn btn-primary btn-lg gap-2 min-h-[52px] text-base">
			<Search size={20} />
			Найти товар
		</a>
		<a href="{base}/chat/" class="btn btn-outline btn-lg gap-2 min-h-[52px] text-base">
			<MessageSquare size={20} />
			Подобрать под задачу
		</a>
		<a href="{base}/kits/" class="btn btn-outline btn-lg gap-2 min-h-[52px] text-base">
			<Package size={20} />
			Готовые комплекты
		</a>
	</div>

	<!-- Suggestion chips -->
	<div class="flex flex-wrap gap-2 mt-8 justify-center max-w-md">
		{#each chips as chip}
			<a
				href="{base}/search/?category={encodeURIComponent(chip.category)}"
				class="badge badge-outline badge-lg py-3 px-4 cursor-pointer hover:bg-primary hover:text-primary-content transition-colors no-underline"
			>
				{chip.label}
			</a>
		{/each}
	</div>

	<!-- Дата обновления каталога -->
	<p class="text-xs text-base-content/40 mt-auto pt-8">
		Каталог обновлён: {catalogDate}
		{#if catalogCount > 0}
			· {catalogCount} товаров
		{/if}
	</p>
</div>
