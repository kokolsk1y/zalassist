import { base } from "$app/paths";

let catalogCache = null;

export async function loadCatalog({ force = false } = {}) {
	if (catalogCache && !force) return catalogCache;

	// При force=true (pull-to-refresh) добавляем cache-buster чтобы обойти SW StaleWhileRevalidate
	const url = base + "/catalog.json" + (force ? `?t=${Date.now()}` : "");
	const response = await fetch(url, force ? { cache: "no-cache" } : {});
	if (!response.ok) throw new Error("Failed to load catalog");

	catalogCache = await response.json();
	console.log("Catalog loaded: " + catalogCache.items.length + " items");
	return catalogCache;
}

export function getCatalogDate() {
	return catalogCache?.lastUpdated ?? "неизвестно";
}

// Поиск товара по штрих-коду упаковки. Возвращает item | null.
// Каталог должен быть загружен; если нет — null без ошибки (вызывающий сам решит).
// Поле `barcode` появится в каталоге после доработки выгрузки из 1С (задача 4).
export function findByBarcode(code) {
	if (!catalogCache || !code) return null;
	const normalized = String(code).trim();
	return catalogCache.items.find(item => {
		if (!item.barcode) return false;
		// barcode в каталоге может быть строкой или массивом (несколько вариантов EAN)
		if (Array.isArray(item.barcode)) {
			return item.barcode.some(b => String(b).trim() === normalized);
		}
		return String(item.barcode).trim() === normalized;
	}) || null;
}
