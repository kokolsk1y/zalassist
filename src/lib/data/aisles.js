import { base } from "$app/paths";

let _cache = null;
let _loading = null;

// Маппинг отделов магазина — где какой стеллаж, какого цвета подсвечивать.
// Загружается лениво, кешируется в памяти. Остаётся валидным до перезагрузки страницы.
export async function loadAisles() {
	if (_cache) return _cache;
	if (_loading) return _loading;
	_loading = (async () => {
		try {
			const res = await fetch(base + "/aisles.json");
			if (!res.ok) throw new Error();
			_cache = await res.json();
		} catch {
			_cache = { departments: {} };
		}
		return _cache;
	})();
	return _loading;
}

// Парсинг строки aisle "3-B-12" → { dept: "3", rack: "B", pos: "12" }
// Допускаются варианты: "3", "3-B", "3-B-12".
export function parseAisle(raw) {
	if (!raw) return null;
	const parts = String(raw).split(/[-–—\s]+/).filter(Boolean);
	if (parts.length === 0) return null;
	return {
		dept: parts[0],
		rack: parts[1] || null,
		pos: parts[2] || null,
	};
}

export function formatAisleLabel(parsed, departments = {}) {
	if (!parsed) return "";
	const deptName = departments[parsed.dept]?.name;
	const head = deptName ? `Отдел ${parsed.dept} — ${deptName}` : `Отдел ${parsed.dept}`;
	const tail = [parsed.rack, parsed.pos].filter(Boolean).join("-");
	return tail ? `${head} · ${tail}` : head;
}
