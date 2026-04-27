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

// PWA Badging API — счётчик подбора на иконке приложения (Android Chrome, Edge desktop).
// На iOS не поддерживается; падать не будет — `?.` обрывает вызов.
function updateAppBadge(count) {
	if (typeof navigator === "undefined") return;
	if (count > 0) navigator.setAppBadge?.(count);
	else navigator.clearAppBadge?.();
}

const _store = writable(load());

// Сохраняем в localStorage и обновляем app badge при каждом изменении
_store.subscribe(items => {
	save(items);
	updateAppBadge(items.length);
});

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
	// Формат заточен под пересылку менеджеру: артикул на отдельной строке
	// (легко копируется double-tap), количество × единица сразу за ним,
	// название мельче на следующей строке для контекста.
	const blocks = items.map((i, idx) => {
		const qty = `${i.qty} ${i.unit || "шт"}`;
		const head = `${idx + 1}. ${i.article}  ×  ${qty}`;
		return i.name ? `${head}\n   ${i.name}` : head;
	});
	const header = "Подбор ЭлектроЦентр";
	const total = items.length === 1
		? "1 позиция"
		: `${items.length} ${items.length < 5 ? "позиции" : "позиций"}`;
	return `${header}\n\n${blocks.join("\n\n")}\n\n— Всего ${total} —`;
}
