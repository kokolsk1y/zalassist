import MiniSearch from "minisearch";
import { normalizeArticle, isArticleLike } from "./normalize.js";
import { synonymGroups, buildSynonymMap } from "./synonyms.js";

const synonymMap = buildSynonymMap(synonymGroups);

function getSynonyms(term) {
	return synonymMap.get(term) || null;
}

/**
 * Объединить два массива результатов MiniSearch, дедупликация по id.
 */
function mergeResults(a, b) {
	const seen = new Map();
	for (const r of a) seen.set(r.id, r);
	for (const r of b) {
		const existing = seen.get(r.id);
		if (existing) {
			existing.score = Math.max(existing.score, r.score);
		} else {
			seen.set(r.id, r);
		}
	}
	return [...seen.values()].sort((a, b) => b.score - a.score);
}

/**
 * Создать поисковый движок на основе MiniSearch.
 * @param {Array} items — массив товаров из catalog.json
 * @returns {{ search, suggest, getFallback }}
 */
export function createSearchEngine(items) {
	// Обогатить товары нормализованным артикулом
	const enriched = items.map(item => ({
		...item,
		articleNorm: normalizeArticle(item.article || "")
	}));

	const miniSearch = new MiniSearch({
		idField: "id",
		fields: ["articleNorm", "article", "name", "description", "category", "brand"],
		storeFields: ["id", "article", "name", "category", "subcategory", "brand",
			"description", "specs", "inStock", "unit"],
		tokenize: (text) => {
			return text.toLowerCase().split(/[\s\-_.,;:!?()/]+/).filter(t => t.length > 0);
		},
		processTerm: (term) => {
			const lower = term.toLowerCase();
			if (lower.length < 1) return false;
			const syns = getSynonyms(lower);
			return syns ? [lower, ...syns] : lower;
		}
	});

	miniSearch.addAll(enriched);

	function search(query, limit = 30) {
		if (!query || !query.trim()) return [];

		const trimmed = query.trim();
		let results = miniSearch.search(trimmed, {
			boost: { articleNorm: 5, article: 3, name: 2, brand: 1.5, category: 1, description: 0.5 },
			fuzzy: 0.2,
			prefix: true,
			combineWith: "OR"
		});

		// Дополнительный поиск по нормализованному артикулу
		if (isArticleLike(trimmed)) {
			const normQuery = normalizeArticle(trimmed);
			if (normQuery.length >= 2) {
				const normResults = miniSearch.search(normQuery, {
					fields: ["articleNorm"],
					fuzzy: 0.3,
					prefix: true
				});
				results = mergeResults(results, normResults);
			}
		}

		return results.slice(0, limit);
	}

	function suggest(query, limit = 3) {
		if (!query || query.trim().length < 2) return [];
		return miniSearch.autoSuggest(query.trim(), {
			fuzzy: 0.2,
			prefix: true
		}).slice(0, limit);
	}

	function getFallback(query, allItems) {
		const words = query.trim().split(/\s+/);
		for (const word of words) {
			if (word.length < 2) continue;
			const partial = miniSearch.search(word, { fuzzy: 0.3, prefix: true });
			if (partial.length > 0) return partial.slice(0, 5);
		}
		// Случайные товары как последний fallback
		const shuffled = [...allItems].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, 5);
	}

	return { search, suggest, getFallback };
}
