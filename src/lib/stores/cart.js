import { writable } from "svelte/store";

function load() {
	if (typeof window === "undefined") return [];
	try {
		const s = localStorage.getItem("zalassist-cart");
		return s ? JSON.parse(s) : [];
	} catch { return []; }
}

function save(items) {
	if (typeof window === "undefined") return;
	try { localStorage.setItem("zalassist-cart", JSON.stringify(items)); } catch {}
}

const _store = writable(load());

// Сохраняем в localStorage при каждом изменении
_store.subscribe(items => save(items));

export const cartStore = _store;

export function cartAdd(product, qty = 1) {
	_store.update(items => {
		const existing = items.find(i => i.id === product.id);
		if (existing) {
			return items.map(i =>
				i.id === product.id ? { ...i, qty: i.qty + qty } : i
			);
		}
		return [...items, { ...product, qty }];
	});
}

export function cartRemove(id) {
	_store.update(items => items.filter(i => i.id !== id));
}

export function cartUpdateQty(id, qty) {
	_store.update(items => {
		if (qty <= 0) return items.filter(i => i.id !== id);
		return items.map(i => i.id === id ? { ...i, qty } : i);
	});
}

export function cartClear() {
	_store.set([]);
}

export function formatCartText(items) {
	if (items.length === 0) return "";
	const lines = items.map(i =>
		`${i.article} — ${i.name}${i.qty > 1 ? " (" + i.qty + " " + (i.unit || "шт") + ")" : ""}`
	);
	return "Список товаров:\n" + lines.join("\n");
}
