/**
 * Преобразовать массив товаров в компактный формат для system prompt.
 * Формат: article | name | category | inStock
 * @param {Array} items — items из catalog.json
 * @returns {string}
 */
export function formatCatalogForAI(items) {
	return items.map(item =>
		`${item.article} | ${item.name} | ${item.category} | ${item.inStock ? "да" : "нет"}`
	).join("\n");
}
