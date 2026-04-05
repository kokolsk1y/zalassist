<script>
	import { base } from "$app/paths";
	import { goto, afterNavigate } from "$app/navigation";
	import { onMount } from "svelte";
	import { Search, ArrowLeft, MessageSquare } from "lucide-svelte";
	import { loadCatalog } from "$lib/data/catalog.js";
	import { createSearchEngine } from "$lib/search/engine.js";
	import { useCart } from "$lib/stores/cart.svelte.js";
	import { toast } from "$lib/stores/toast.svelte.js";
	import ProductCard from "$lib/components/ProductCard.svelte";
	import ProductSheet from "$lib/components/ProductSheet.svelte";

	const cart = useCart();
	let categories = $state([]);

	const PAGE_SIZE = 20;

	let catalog = $state(null);
	let engine = $state(null);
	let results = $state([]);
	let fallbackResults = $state([]);
	let isZeroResult = $state(false);
	let loading = $state(true);
	let inputValue = $state("");
	let selectedProduct = $state(null);
	let query = $state("");
	let categoryParam = $state("");
	let activeCategory = $state("");
	let visibleCount = $state(PAGE_SIZE);

	// Сортировка и фильтр по цене
	let sortBy = $state("relevance");
	let priceMin = $state("");
	let priceMax = $state("");
	let showFilters = $state(false);

	function getFilteredResults() {
		let filtered = results;
		const min = Number(priceMin) || 0;
		const max = Number(priceMax) || Infinity;
		if (min > 0 || max < Infinity) {
			filtered = filtered.filter(p => p.price >= min && p.price <= max);
		}
		if (sortBy === "price_asc") {
			filtered = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0));
		} else if (sortBy === "price_desc") {
			filtered = [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0));
		} else if (sortBy === "name") {
			filtered = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
		}
		return filtered;
	}

	function parseUrl() {
		const url = new URL(window.location.href);
		query = url.searchParams.get("q") || "";
		categoryParam = url.searchParams.get("category") || "";
		activeCategory = categoryParam;
		inputValue = query || inputValue;
	}

	function runSearch() {
		if (!engine || !catalog) return;
		visibleCount = PAGE_SIZE;
		if (activeCategory) {
			results = catalog.items.filter(i => i.category === activeCategory);
			isZeroResult = results.length === 0;
			fallbackResults = [];
		} else if (query) {
			const found = engine.search(query);
			if (found.length > 0) {
				results = found;
				isZeroResult = false;
				fallbackResults = [];
			} else {
				results = [];
				isZeroResult = true;
				fallbackResults = engine.getFallback(query, catalog.items);
			}
		} else {
			results = [];
			isZeroResult = false;
			fallbackResults = [];
		}
	}

	onMount(async () => {
		parseUrl();
		try {
			catalog = await loadCatalog();
			engine = createSearchEngine(catalog.items);
			// Собираем уникальные категории из каталога
			const catSet = new Set(catalog.items.map(i => i.category).filter(Boolean));
			categories = [...catSet].sort();
			runSearch();
			loading = false;
		} catch (e) {
			loading = false;
		}
	});

	// При client-side навигации (goto) — обновить параметры и перезапустить поиск
	afterNavigate(() => {
		parseUrl();
		runSearch();
	});

	function handleSearch() {
		const q = inputValue.trim();
		if (q) goto(`${base}/search/?q=${encodeURIComponent(q)}`);
	}

	function addToCart(product) {
		cart.add(product);
		toast.show("✓ Добавлено в список");
	}

	function removeFromCart(id) {
		cart.remove(id);
		toast.show("Убрано из списка");
	}
</script>

<div class="min-h-screen bg-base-200 flex flex-col">
	<!-- Header -->
	<div class="sticky top-0 bg-base-100 shadow-sm z-40 px-4 py-3">
		<div class="flex items-center gap-3 max-w-md mx-auto">
			<button onclick={() => goto(`${base}/`)} class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]" aria-label="Назад">
				<ArrowLeft size={22} />
			</button>
			<div class="flex-1 relative">
				<input
					type="text"
					placeholder="Артикул, название или задача..."
					class="input input-bordered w-full pr-12 min-h-[44px] text-base"
					bind:value={inputValue}
					onkeydown={(e) => { if (e.key === "Enter") handleSearch(); }}
				/>
				<button
					class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-circle min-h-[40px] min-w-[40px]"
					onclick={handleSearch}
					aria-label="Искать"
				>
					<Search size={20} />
				</button>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 px-4 py-4 max-w-md mx-auto w-full">
		{#if loading}
			<div class="flex flex-col gap-3">
				{#each [1, 2, 3] as _}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body p-4">
							<div class="skeleton h-3 w-24"></div>
							<div class="skeleton h-4 w-full mt-2"></div>
							<div class="skeleton h-3 w-32 mt-2"></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if !query && !activeCategory}
			<h2 class="text-lg font-bold text-base-content mb-4">Выберите категорию</h2>
			<div class="flex flex-wrap gap-2">
				{#each categories as cat}
					<button
						onclick={() => goto(`${base}/search/?category=${encodeURIComponent(cat)}`)}
						class="badge badge-lg badge-outline py-3 px-4 cursor-pointer hover:bg-primary hover:text-primary-content transition-colors"
					>
						{cat}
					</button>
				{/each}
			</div>
		{:else if isZeroResult}
			<div class="text-center py-8">
				<Search size={48} class="mx-auto text-base-content/20 mb-4" />
				<p class="text-base-content/60 mb-2">
					По запросу «<span class="font-semibold">{query || categoryParam}</span>» ничего не найдено
				</p>
				{#if fallbackResults.length > 0}
					<p class="text-sm text-base-content/60 mb-4">Возможно, вы искали:</p>
					<div class="flex flex-col gap-3">
						{#each fallbackResults as product (product.id)}
							<ProductCard
								{product}
								onselect={(p) => selectedProduct = p}
								onadd={addToCart}
								onremove={removeFromCart}
								inCart={cart.items.some(i => i.id === product.id)}
							/>
						{/each}
					</div>
				{/if}
				<button onclick={() => goto(`${base}/chat/`)} class="btn btn-outline gap-2 mt-6 min-h-[44px]">
					<MessageSquare size={20} />
					Спросить ИИ-помощника
				</button>
			</div>
		{:else}
			{@const displayed = getFilteredResults()}
			{#if activeCategory}
				<div class="flex items-center gap-2 mb-3">
					<h2 class="text-lg font-bold text-base-content">{activeCategory}</h2>
					<span class="badge badge-sm badge-ghost">{displayed.length}</span>
					<button onclick={() => goto(`${base}/search/`)} class="ml-auto text-sm text-primary">Сбросить</button>
				</div>
			{:else}
				<div class="flex items-center gap-2 mb-3">
					<p class="text-sm text-base-content/60">Результатов: {displayed.length}</p>
					<button onclick={() => goto(`${base}/search/`)} class="ml-auto text-sm text-primary">Сбросить</button>
				</div>
			{/if}

			<!-- Сортировка и фильтр -->
			<div class="flex items-center gap-2 mb-3">
				<select bind:value={sortBy} class="select select-bordered select-sm flex-1 min-h-[36px]">
					<option value="relevance">По релевантности</option>
					<option value="price_asc">Сначала дешёвые</option>
					<option value="price_desc">Сначала дорогие</option>
					<option value="name">По названию</option>
				</select>
				<button
					class="btn btn-sm btn-outline min-h-[36px] gap-1"
					class:btn-primary={showFilters || priceMin || priceMax}
					onclick={() => showFilters = !showFilters}
				>
					Цена {#if priceMin || priceMax}({priceMin || "0"}–{priceMax || "∞"}){/if}
				</button>
			</div>

			{#if showFilters}
				<div class="flex items-center gap-2 mb-3">
					<input type="number" bind:value={priceMin} placeholder="от" class="input input-bordered input-sm w-24 min-h-[36px]" min="0" />
					<span class="text-base-content/40">—</span>
					<input type="number" bind:value={priceMax} placeholder="до" class="input input-bordered input-sm w-24 min-h-[36px]" min="0" />
					<span class="text-xs text-base-content/50">₽</span>
					{#if priceMin || priceMax}
						<button class="btn btn-ghost btn-xs" onclick={() => { priceMin = ""; priceMax = ""; }}>Сбросить</button>
					{/if}
				</div>
			{/if}

			<div class="flex flex-col gap-3">
				{#each displayed.slice(0, visibleCount) as product (product.id)}
					<ProductCard
						{product}
						onselect={(p) => selectedProduct = p}
						onadd={addToCart}
						onremove={removeFromCart}
						inCart={cart.items.some(i => i.id === product.id)}
					/>
				{/each}
			</div>

			{#if displayed.length > visibleCount}
				<button
					class="btn btn-outline w-full mt-4 min-h-[44px]"
					onclick={() => visibleCount += PAGE_SIZE}
				>
					Показать ещё ({displayed.length - visibleCount} осталось)
				</button>
			{/if}

			<p class="text-xs text-base-content/60 text-center mt-6 mb-4">
				Наличие и цены уточняйте у консультанта
			</p>
		{/if}
	</div>
</div>

<ProductSheet
	product={selectedProduct}
	onclose={() => selectedProduct = null}
	onadd={addToCart}
/>
