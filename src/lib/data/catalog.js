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
