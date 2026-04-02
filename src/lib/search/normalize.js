const cyrToLat = {
	"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
	"ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
	"н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
	"ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
	"ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya"
};

/**
 * Нормализация артикула для поиска.
 * "ВА47-29 1P 16А" -> "va47291p16a"
 * "BA47-29-1P-16A" -> "ba47291p16a"
 */
export function normalizeArticle(str) {
	return str
		.toLowerCase()
		.split("")
		.map(ch => cyrToLat[ch] ?? ch)
		.join("")
		.replace(/[\s\-_./]+/g, "")
		.replace(/[^a-z0-9]/g, "");
}

/**
 * Проверить, похож ли запрос на артикул (содержит цифры).
 */
export function isArticleLike(query) {
	return /\d/.test(query);
}
