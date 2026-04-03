let items = $state([]);

export function getCartItems() {
	return items;
}

export function getCartCount() {
	return items.length;
}

export function addToCart(product, qty = 1) {
	const existing = items.find(i => i.id === product.id);
	if (existing) {
		items = items.map(i =>
			i.id === product.id ? { ...i, qty: i.qty + qty } : i
		);
	} else {
		items = [...items, { ...product, qty }];
	}
}

export function removeFromCart(id) {
	items = items.filter(i => i.id !== id);
}

export function updateCartQty(id, qty) {
	if (qty <= 0) {
		items = items.filter(i => i.id !== id);
	} else {
		items = items.map(i =>
			i.id === id ? { ...i, qty } : i
		);
	}
}

export function clearCart() {
	items = [];
}

export function formatCartText() {
	if (items.length === 0) return "";
	const lines = items.map(i =>
		`${i.article} — ${i.name}${i.qty > 1 ? " (" + i.qty + " " + (i.unit || "шт") + ")" : ""}`
	);
	return "Список товаров:\n" + lines.join("\n");
}
