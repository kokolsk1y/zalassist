<script>
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import { Search, ArrowLeft, ShoppingCart, MessageSquare } from "lucide-svelte";
	import { loadCatalog } from "$lib/data/catalog.js";
	import { createSearchEngine } from "$lib/search/engine.js";
	import { cart } from "$lib/stores/cart.svelte.js";
	import ProductCard from "$lib/components/ProductCard.svelte";
	import ProductSheet from "$lib/components/ProductSheet.svelte";
	import CartPanel from "$lib/components/CartPanel.svelte";

	// Маппинг чипсов -> реальных категорий из каталога
	const categoryMap = {
		"Автоматы": "Автоматические выключатели",
		"Кабель": "Кабель и провод",
		"Розетки": "Розетки и выключатели",
		"Щиты": "Щиты и боксы",
		"Освещение": "Освещение",
		"УЗО": "УЗО",
		"АВДТ": "АВДТ (дифавтоматы)",
		"Каналы": "Кабельные каналы"
	};

	const chipLabels = Object.keys(categoryMap);

	let catalog = $state(null);
	let engine = $state(null);
	let results = $state([]);
	let fallbackResults = $state([]);
	let isZeroResult = $state(false);
	let loading = $state(true);
	let inputValue = $state("");
	let selectedProduct = $state(null);
	let showCartPanel = $state(false);

	let query = $derived(page.url.searchParams.get("q") || "");
	let categoryParam = $derived(page.url.searchParams.get("category") || "");
	let activeCategory = $derived(categoryMap[categoryParam] || "");

	onMount(async () => {
		try {
			catalog = await loadCatalog();
			engine = createSearchEngine(catalog.items);
			inputValue = query;
			loading = false;
		} catch (e) {
			console.error("Failed to load catalog:", e);
			loading = false;
		}
	});

	// Реактивный поиск при изменении query/category
	$effect(() => {
		if (!engine || !catalog) return;

		if (activeCategory) {
			// Фильтр по категории
			results = catalog.items.filter(i => i.category === activeCategory);
			isZeroResult = results.length === 0;
			fallbackResults = [];
		} else if (query) {
			// Текстовый поиск
			inputValue = query;
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
			// Пустое состояние — показать категории
			results = [];
			isZeroResult = false;
			fallbackResults = [];
		}
	});

	function handleSearch() {
		const q = inputValue.trim();
		if (q) {
			goto(`${base}/search/?q=${encodeURIComponent(q)}`);
		}
	}

	function handleKeydown(e) {
		if (e.key === "Enter") handleSearch();
	}

	function addToCart(product) {
		cart.add(product);
	}

	function removeFromCart(id) {
		cart.remove(id);
	}

	function isInCart(productId) {
		return cart.items.some(i => i.id === productId);
	}
</script>

<div class="min-h-screen bg-base-200 flex flex-col">
	<!-- Header -->
	<div class="sticky top-0 bg-base-100 shadow-sm z-40 px-4 py-3">
		<div class="flex items-center gap-3 max-w-md mx-auto">
			<a href="{base}/" class="btn btn-ghost btn-sm btn-circle" aria-label="Назад" data-sveltekit-reload>
				<ArrowLeft size={20} />
			</a>
			<div class="flex-1 relative">
				<input
					type="text"
					placeholder="Артикул, название или задача..."
					class="input input-bordered input-sm w-full pr-10"
					bind:value={inputValue}
					onkeydown={handleKeydown}
				/>
				<button
					class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
					onclick={handleSearch}
					aria-label="Искать"
				>
					<Search size={16} />
				</button>
			</div>
			{#if cart.count > 0}
				<button
					class="btn btn-primary btn-sm btn-circle relative"
					onclick={() => showCartPanel = true}
					aria-label="Список товаров"
				>
					<ShoppingCart size={16} />
					<span class="absolute -top-1 -right-1 badge badge-secondary badge-xs">{cart.count}</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 px-4 py-4 max-w-md mx-auto w-full">
		{#if loading}
			<!-- Loading skeleton -->
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
			<!-- Пустое состояние: категории -->
			<h2 class="text-lg font-bold text-base-content mb-4">Выберите категорию</h2>
			<div class="flex flex-wrap gap-2">
				{#each chipLabels as chip}
					<a
						href="{base}/search/?category={encodeURIComponent(chip)}"
						class="badge badge-lg badge-outline py-3 px-4 cursor-pointer hover:bg-primary hover:text-primary-content transition-colors"
					>
						{chip}
					</a>
				{/each}
			</div>
		{:else if isZeroResult}
			<!-- Zero-result -->
			<div class="text-center py-8">
				<Search size={48} class="mx-auto text-base-content/20 mb-4" />
				<p class="text-base-content/60 mb-2">
					По запросу «<span class="font-semibold">{query || categoryParam}</span>» ничего не найдено
				</p>

				{#if fallbackResults.length > 0}
					<p class="text-sm text-base-content/40 mb-4">Возможно, вы искали:</p>
					<div class="flex flex-col gap-3">
						{#each fallbackResults as product (product.id)}
							<ProductCard
								{product}
								onselect={(p) => selectedProduct = p}
								onadd={addToCart}
								onremove={removeFromCart}
								inCart={isInCart(product.id)}
							/>
						{/each}
					</div>
				{/if}

				<a href="{base}/chat/" class="btn btn-outline btn-sm gap-2 mt-6">
					<MessageSquare size={16} />
					Спросить ИИ (скоро)
				</a>
			</div>
		{:else}
			<!-- Результаты -->
			{#if activeCategory}
				<div class="flex items-center gap-2 mb-3">
					<h2 class="text-lg font-bold text-base-content">{activeCategory}</h2>
					<span class="badge badge-sm badge-ghost">{results.length}</span>
					<a href="{base}/search/" class="ml-auto text-sm text-primary">Сбросить</a>
				</div>
			{:else}
				<div class="flex items-center gap-2 mb-3">
					<p class="text-sm text-base-content/60">Результатов: {results.length}</p>
					<a href="{base}/search/" class="ml-auto text-sm text-primary">Сбросить</a>
				</div>
			{/if}

			<div class="flex flex-col gap-3">
				{#each results as product (product.id)}
					<ProductCard
						{product}
						onselect={(p) => selectedProduct = p}
						onadd={addToCart}
						onremove={removeFromCart}
						inCart={isInCart(product.id)}
					/>
				{/each}
			</div>

			<!-- Дисклеймер (UI-05) -->
			<p class="text-xs text-base-content/40 text-center mt-6 mb-4">
				Наличие и цены уточняйте у консультанта
			</p>
		{/if}
	</div>
</div>

<!-- Product bottom sheet -->
<ProductSheet
	product={selectedProduct}
	onclose={() => selectedProduct = null}
	onadd={addToCart}
/>

<!-- Cart panel -->
<CartPanel open={showCartPanel} onclose={() => showCartPanel = false} />
