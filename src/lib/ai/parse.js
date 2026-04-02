/**
 * Найти товары из каталога, упомянутые в тексте ответа ИИ.
 * Вызывать ТОЛЬКО после onDone (полный текст), не во время стриминга.
 *
 * @param {string} text — полный текст ответа ИИ
 * @param {Array} catalogItems — items из catalog.json
 * @returns {Array} — массив товаров из каталога, найденных в тексте
 */
export function extractProducts(text, catalogItems) {
	if (!text || !catalogItems) return [];

	const upperText = text.toUpperCase();
	const found = [];

	for (const item of catalogItems) {
		if (!item.article) continue;
		const upperArticle = item.article.toUpperCase();
		if (upperArticle.length >= 3 && upperText.includes(upperArticle)) {
			found.push(item);
		}
	}

	return found;
}
