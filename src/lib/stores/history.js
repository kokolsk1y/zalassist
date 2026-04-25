// Локальная история: последние просмотренные товары и поисковые запросы.
// Хранится только в браузере клиента (localStorage), не уходит на сервер,
// никаких персональных данных. На главной/в поиске показываем как удобство.

import { writable } from "svelte/store";

const VIEWED_KEY = "zalassist-recently-viewed";
const SEARCH_KEY = "zalassist-search-history";
const MAX_VIEWED = 10;
const MAX_SEARCH = 5;

function loadList(key) {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveList(key, list) {
	if (typeof window === "undefined") return;
	try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
}

// === Recently viewed (товары) ===
export const recentlyViewedStore = writable(loadList(VIEWED_KEY));

export function addRecentlyViewed(product) {
	if (!product?.id) return;
	recentlyViewedStore.update((list) => {
		// Убираем дубль если уже был — он переедет в начало
		const filtered = list.filter((p) => p.id !== product.id);
		// Храним минимально нужный набор полей чтобы не раздувать localStorage
		const slim = {
			id: product.id,
			article: product.article,
			name: product.name,
			price: product.price,
			photo: product.photo,
			unit: product.unit,
			inStock: product.inStock,
		};
		const next = [slim, ...filtered].slice(0, MAX_VIEWED);
		saveList(VIEWED_KEY, next);
		return next;
	});
}

export function clearRecentlyViewed() {
	recentlyViewedStore.set([]);
	saveList(VIEWED_KEY, []);
}

// === Search history (поисковые запросы) ===
export const searchHistoryStore = writable(loadList(SEARCH_KEY));

export function addSearchHistory(query) {
	const q = String(query || "").trim();
	if (!q || q.length < 2) return;
	searchHistoryStore.update((list) => {
		// Дубли по нижнему регистру убираем — повторный запрос двигает в начало
		const filtered = list.filter((s) => s.toLowerCase() !== q.toLowerCase());
		const next = [q, ...filtered].slice(0, MAX_SEARCH);
		saveList(SEARCH_KEY, next);
		return next;
	});
}

export function removeSearchHistory(query) {
	searchHistoryStore.update((list) => {
		const next = list.filter((s) => s !== query);
		saveList(SEARCH_KEY, next);
		return next;
	});
}

export function clearSearchHistory() {
	searchHistoryStore.set([]);
	saveList(SEARCH_KEY, []);
}
