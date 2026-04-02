let items = $state([]);

export const cart = {
	get items() { return items; },
	get count() { return items.length; },

	add(product, qty = 1) {
		const existing = items.find(i => i.id === product.id);
		if (existing) {
			existing.qty += qty;
		} else {
			items.push({ ...product, qty });
		}
	},

	remove(id) {
		items = items.filter(i => i.id !== id);
	},

	updateQty(id, qty) {
		const item = items.find(i => i.id === id);
		if (item) {
			if (qty <= 0) {
				items = items.filter(i => i.id !== id);
			} else {
				item.qty = qty;
			}
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
