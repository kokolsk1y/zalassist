import { base } from "$app/paths";

let catalogCache = null;

export async function loadCatalog() {
	if (catalogCache) return catalogCache;

	const response = await fetch(base + "/catalog.json");
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
