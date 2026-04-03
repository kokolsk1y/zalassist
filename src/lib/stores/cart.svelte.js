let items = $state([]);

export const cart = {
	get items() { return items; },
	get count() { return items.length; },

	add(product, qty = 1) {
		const existing = items.find(i => i.id === product.id);
		if (existing) {
			// Создаём новый массив для тригера реактивности
			items = items.map(i =>
				i.id === product.id ? { ...i, qty: i.qty + qty } : i
			);
		} else {
			items = [...items, { ...product, qty }];
		}
	},

	remove(id) {
		items = items.filter(i => i.id !== id);
	},

	updateQty(id, qty) {
		if (qty <= 0) {
			items = items.filter(i => i.id !== id);
		} else {
			items = items.map(i =>
				i.id === id ? { ...i, qty } : i
			);
		}
	},

	clear() {
		items = [];
	},

	formatText() {
		if (items.length === 0) return "";
		const lines = items.map(i =>
			`${i.article} — ${i.name}${i.qty > 1 ? " (" + i.qty + " " + (i.unit || "шт") + ")" : ""}`
		);
		return "Список товаров:\n" + lines.join("\n");
	}
};
