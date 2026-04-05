/**
 * Преобразовать массив товаров в компактный формат для system prompt.
 * Формат: article | name | category | price | inStock
 * @param {Array} items — подмножество товаров
 * @returns {string}
 */
export function formatCatalogForAI(items) {
	return items.map(item =>
		`${item.article} | ${item.name} | ${item.category} | ${item.price || "?"} ₽ | ${item.inStock ? "да" : "нет"}`
	).join("\n");
}

/**
 * Подобрать релевантные товары для AI-промпта.
 * 1. Ищем по текущему сообщению через MiniSearch
 * 2. Добавляем товары из предыдущих ответов AI (чтобы контекст не терялся)
 * 3. Ограничиваем до maxItems
 *
 * @param {string} message — текущее сообщение пользователя
 * @param {Array} history — история сообщений [{role, content}]
 * @param {object} searchEngine — объект из createSearchEngine
 * @param {Array} allItems — полный каталог
 * @param {number} maxItems — максимум товаров для промпта
 * @returns {Array} — подмножество товаров для AI
 */
export function selectItemsForAI(message, history, searchEngine, allItems, maxItems = 50) {
	const itemMap = new Map();

	// 1. Поиск по текущему сообщению
	const searchResults = searchEngine.search(message, maxItems);
	for (const r of searchResults) {
		itemMap.set(r.id, allItems.find(i => i.id === r.id) || r);
	}

	// 2. Добавляем товары из контекста — артикулы упомянутые в прошлых ответах AI
	const assistantMessages = history
		.filter(m => m.role === "assistant")
		.map(m => m.content)
		.join(" ")
		.toUpperCase();

	if (assistantMessages) {
		for (const item of allItems) {
			if (itemMap.size >= maxItems) break;
			if (!item.article) continue;
			if (assistantMessages.includes(item.article.toUpperCase())) {
				itemMap.set(item.id, item);
			}
		}
	}

	// 3. Если совсем мало результатов — пробуем пословный поиск
	if (itemMap.size < 10) {
		const words = message.split(/\s+/).filter(w => w.length >= 3);
		for (const word of words) {
			const wordResults = searchEngine.search(word, 15);
			for (const r of wordResults) {
				if (itemMap.size >= maxItems) break;
				itemMap.set(r.id, allItems.find(i => i.id === r.id) || r);
			}
		}
	}

	return [...itemMap.values()];
}
