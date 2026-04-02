<script>
	import { base } from "$app/paths";
	import { onMount } from "svelte";
	import { loadCatalog, getCatalogDate } from "$lib/data/catalog.js";
	import { Search, MessageSquare, Package } from "lucide-svelte";

	let catalogDate = $state("...");
	let catalogCount = $state(0);

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
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center px-4 pt-12 pb-8">
	<!-- Лого -->
	<div class="mb-8 text-center">
		<h1 class="text-2xl font-bold text-primary">ЭлектроЦентр</h1>
		<p class="text-sm text-base-content/60 mt-1">Помощник в торговом зале</p>
	</div>

	<!-- Hero -->
	<h2 class="text-3xl font-bold text-base-content mb-6 text-center">
		Что будем делать?
	</h2>

	<!-- Поле ввода -->
	<div class="w-full max-w-md mb-6">
		<input
			type="text"
			placeholder="Артикул, название или задача..."
			class="input input-bordered input-lg w-full bg-base-100 shadow-md focus:border-primary focus:shadow-lg transition-all"
		/>
	</div>

	<!-- 3 CTA -->
	<div class="w-full max-w-md flex flex-col gap-3">
		<a href="{base}/search" class="btn btn-primary btn-lg gap-2 min-h-[52px] text-base">
			<Search size={20} />
			Найти товар
		</a>
		<a href="{base}/chat" class="btn btn-outline btn-lg gap-2 min-h-[52px] text-base">
			<MessageSquare size={20} />
			Подобрать под задачу
		</a>
		<a href="{base}/kits" class="btn btn-outline btn-lg gap-2 min-h-[52px] text-base">
			<Package size={20} />
			Готовые комплекты
		</a>
	</div>

	<!-- Suggestion chips -->
	<div class="flex flex-wrap gap-2 mt-8 justify-center max-w-md">
		{#each ["Автоматы", "Кабель", "Розетки", "Щиты", "Освещение", "УЗО", "Инструмент"] as chip}
			<button class="badge badge-outline badge-lg py-3 px-4 cursor-pointer hover:bg-primary hover:text-primary-content transition-colors">
				{chip}
			</button>
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
