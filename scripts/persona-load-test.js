/**
 * ZalAssist — Нагрузочный тест: 25 персон одновременно
 *
 * Запуск: node scripts/persona-load-test.js
 *
 * Что делает:
 * 1. Загружает каталог и создаёт поисковый движок (как клиент)
 * 2. Все 25 персон отправляют запросы ОДНОВРЕМЕННО
 * 3. Измеряет время ответа, ошибки, качество
 * 4. Выводит подробный отчёт
 */

import { readFileSync } from "fs";
import MiniSearch from "minisearch";

// ─── КОНФИГ ──────────────────────────────────────────────
const API_URL = "https://functions.yandexcloud.net/d4e3bfsiqg0jbf7b99jg";
const TIMEOUT_MS = 30000; // 30 сек на тест (клиент даёт 15)
const CATALOG_PATH = "./static/catalog.json";

// ─── СИНОНИМЫ (копия из src/lib/search/synonyms.js) ──────
const synonymGroups = [
	["дифавтомат", "авдт", "дифференциальный автомат"],
	["узо", "вд", "устройство защитного отключения"],
	["автомат", "ав", "автоматический выключатель"],
	["iek", "иек", "иэк"],
	["schneider", "шнайдер", "schneider electric"],
	["legrand", "легранд"],
	["кабель", "провод"],
	["ввг", "ввгнг", "ввгнг-ls", "ввг-пнг"],
	["розетка", "электророзетка"],
	["выключатель", "переключатель"],
	["удлинитель", "переноска", "сетевой фильтр"],
	["лампа", "лампочка", "led лампа", "светодиодная лампа"],
	["светильник", "люстра", "плафон"],
	["щит", "щиток", "бокс"],
	["дрель", "шуруповёрт", "шуруповерт"],
	["болгарка", "ушм", "угловая шлифмашина"],
	["мультиметр", "тестер", "измеритель"],
	["обогреватель", "конвектор", "тепловентилятор"],
	["гофра", "гофротруба", "гофрированная труба"],
	["контактор", "пускатель", "магнитный пускатель"],
	["диммер", "светорегулятор"],
	["прожектор", "led прожектор"],
	["рубильник", "разъединитель"],
	["bosch", "бош"],
	["makita", "макита"],
];

function buildSynonymMap(groups) {
	const map = new Map();
	for (const group of groups) {
		for (const term of group) {
			const others = group.filter(t => t !== term);
			map.set(term, others);
		}
	}
	return map;
}

const synonymMap = buildSynonymMap(synonymGroups);

// ─── НОРМАЛИЗАЦИЯ АРТИКУЛОВ ──────────────────────────────
const cyrToLat = {
	"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
	"ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
	"н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
	"ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
	"ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya"
};

function normalizeArticle(str) {
	return str.toLowerCase().split("")
		.map(ch => cyrToLat[ch] ?? ch).join("")
		.replace(/[\s\-_./]+/g, "")
		.replace(/[^a-z0-9]/g, "");
}

// ─── ЗАГРУЗКА КАТАЛОГА И ПОИСКОВЫЙ ДВИЖОК ────────────────
console.log("Загрузка каталога...");
const catalogStart = Date.now();
const catalogData = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const items = catalogData.items;
console.log(`  Товаров: ${items.length}`);
console.log(`  Парсинг: ${Date.now() - catalogStart} мс`);

console.log("Создание поискового движка...");
const indexStart = Date.now();
const enriched = items.map(item => ({
	...item,
	articleNorm: normalizeArticle(item.article || "")
}));

const miniSearch = new MiniSearch({
	idField: "id",
	fields: ["articleNorm", "article", "name", "description", "category", "brand"],
	storeFields: ["id", "article", "name", "category", "brand", "price", "inStock", "quantity", "unit"],
	tokenize: (text) => text.toLowerCase().split(/[\s\-_.,;:!?()/]+/).filter(t => t.length > 0),
	processTerm: (term) => {
		const lower = term.toLowerCase();
		if (lower.length < 1) return false;
		const syns = synonymMap.get(lower);
		return syns ? [lower, ...syns] : lower;
	}
});
miniSearch.addAll(enriched);
console.log(`  Индексация: ${Date.now() - indexStart} мс\n`);

// ─── ПОИСК И ФОРМАТИРОВАНИЕ ─────────────────────────────
function searchItems(query, limit = 50) {
	if (!query?.trim()) return [];
	const results = miniSearch.search(query.trim(), {
		boost: { articleNorm: 5, article: 3, name: 2, brand: 1.5, category: 1, description: 0.5 },
		fuzzy: 0.2,
		prefix: true,
		combineWith: "OR"
	});
	return results.map(r => items.find(i => i.id === r.id)).filter(Boolean).slice(0, limit);
}

function formatCatalogForAI(items) {
	return items.map(item =>
		`${item.article} | ${item.name} | ${item.category} | ${item.price || "?"} ₽ | ${item.inStock ? "да" : "нет"}`
	).join("\n");
}

// ─── 25 ПЕРСОН ───────────────────────────────────────────
const personas = [
	// Группа A: Профессионалы
	{
		id: 1, name: "Михалыч", age: 55, group: "A:Профи",
		device: "Xiaomi Redmi Note 10",
		message: "ВА47-29 1P 16А — 6шт, ВВГнг 3х2.5 бухту, и УЗО 40А 30мА 2шт. Есть всё?"
	},
	{
		id: 2, name: "Сергей", age: 35, group: "A:Профи",
		device: "Samsung A54",
		message: "Мне АВДТ на 30мА, что есть? Шнайдер или IEK. И гребёнку 3P для них."
	},
	{
		id: 3, name: "Карина", age: 29, group: "A:Профи",
		device: "iPhone 15",
		message: "Розетки и выключатели Legrand в бежевом цвете. Нужно 12 розеток, 8 выключателей двухклавишных, рамки двойные 6шт."
	},
	{
		id: 4, name: "Ринат", age: 40, group: "A:Профи",
		device: "iPhone 13",
		message: "Прайс: автомат IEK 16А 20шт, автомат 25А 10шт, кабель ВВГнг 3х1.5 200м, ВВГнг 3х2.5 100м, УЗО 40А 30мА 5шт. Оптовая цена есть?"
	},
	{
		id: 5, name: "Дмитрий", age: 31, group: "A:Профи",
		device: "Xiaomi POCO X5",
		message: "Автомат 1P 32А, АВДТ 2P С25 30мА, клеммы WAGO 5-проводные пачку. Есть в наличии?"
	},

	// Группа B: Средний уровень
	{
		id: 6, name: "Максим", age: 30, group: "B:Средний",
		device: "iPhone 14",
		message: "Хочу собрать щиток на 24 модуля для трёшки. Нужны автоматы на каждую линию, УЗО, и реле напряжения. Что посоветуете?"
	},
	{
		id: 7, name: "Елена", age: 38, group: "B:Средний",
		device: "Samsung S23",
		message: "Какие серии розеток у вас есть? Мне для кухни белые, минимум 6 штук и выключатели в той же серии. Покажите все варианты по цене."
	},
	{
		id: 8, name: "Андрей", age: 48, group: "B:Средний",
		device: "iPhone 14 Pro",
		message: "Офис 200м2, нужно: панели светодиодные потолочные, розетки 20шт, автоматы. Всё сразу, быстро. Что по деньгам?"
	},
	{
		id: 9, name: "Виктор", age: 42, group: "B:Средний",
		device: "Xiaomi POCO X5",
		message: "Делаю ванную. Нужна проводка: кабель, автомат, светильник влагозащищённый, розетка для ванной, вентилятор вытяжной. Что брать?"
	},
	{
		id: 10, name: "Даша и Костя", age: 28, group: "B:Средний",
		device: "iPhone SE 3",
		message: "Первый ремонт, однушка. Нужна вся электрика с нуля — щиток, автоматы, кабель, розетки, выключатели. С чего начать и что купить?"
	},

	// Группа C: Новички
	{
		id: 11, name: "Ольга", age: 62, group: "C:Новичок",
		device: "Samsung A14",
		message: "Значит у меня дача, дом старый. Нужен свет на веранду чтоб не моргал и автомат чтоб не выбивало. И лампочки тёплые 3 штуки. Посоветуйте."
	},
	{
		id: 12, name: "Марина", age: 45, group: "C:Новичок",
		device: "Xiaomi Redmi 12",
		message: "Муж скинул: афтамат iek 20а 2шт, удленитель 5м, лампы тёпл 10вт 5шт, розетка двойная наружная, изолента. Это всё есть у вас?"
	},
	{
		id: 13, name: "Артём", age: 20, group: "C:Новичок",
		device: "iPhone SE 3",
		message: "Розетка искрит, надо поменять. Что самое дешёвое? И удлинитель нормальный метра 3."
	},
	{
		id: 14, name: "Людмила Сергеевна", age: 52, group: "C:Новичок",
		device: "Samsung A14",
		message: "Закупка для школы по смете: светильники потолочные 20шт, лампы LED 30шт, выключатели 10шт. Нужно уложиться в 45 тысяч. Что подберёте?"
	},
	{
		id: 15, name: "Саня", age: 37, group: "C:Новичок",
		device: "Xiaomi Redmi 9",
		message: "Удлинитель 5 метров и изолента. Быстро."
	},

	// Группа D: Сложные
	{
		id: 16, name: "Николай Петрович", age: 72, group: "D:Сложный",
		device: "Samsung A03",
		message: "здраствуйте мне нужны лампочки обычные для люстры 3 штуки и на кухню 2 штуки и в коридор одну. как раньше были только яркие"
	},
	{
		id: 17, name: "Валентина Ивановна", age: 78, group: "D:Сложный",
		device: "Xiaomi Redmi 9A",
		message: "тут написано от внука: дифф авт С16 30мА 1шт, узо 40А 30мА 2шт, автомат С10 4шт. я не знаю что это помогите пожалуйста"
	},
	{
		id: 18, name: "Азиз", age: 33, group: "D:Сложный",
		device: "Realme C30",
		message: "привет мне нада провод для стройка 100 метр самый толстый и автомат 25 ампер десять штук и розетка двадцать штук самый дешёвый"
	},
	{
		id: 19, name: "Алина", age: 19, group: "D:Сложный",
		device: "iPhone 14",
		message: "есть розетки в бежевом?? чтоб прям минимализм без рамок страшных. и выключатель такой же. и ночник может какой красивый"
	},
	{
		id: 20, name: "Кирилл", age: 16, group: "D:Сложный",
		device: "Xiaomi Redmi Note 11",
		message: "выкл 2клав бел"
	},

	// Группа E: Постоянные
	{
		id: 21, name: "Игорь", age: 44, group: "E:Постоянный",
		device: "Samsung A54",
		message: "Список на неделю: автомат 1P 16А 10шт, автомат 1P 25А 5шт, УЗО 2P 40А/30мА 3шт, кабель ВВГнг 3х1.5 100м, кабель 3х2.5 50м, розетки 20шт, выключатели 10шт"
	},
	{
		id: 22, name: "Руслан", age: 39, group: "E:Постоянный",
		device: "iPhone 13",
		message: "Объект: квартира 80м2. Нужна смета на электрику: щит, автоматика, кабель, розетки-выключатели. Бюджет до 150 тысяч. Счёт с НДС можно?"
	},
	{
		id: 23, name: "Дядя Женя", age: 58, group: "E:Постоянный",
		device: "Samsung A21",
		message: "Что нового из Шнайдера у вас появилось? И автоматы Legrand завезли наконец?"
	},
	{
		id: 24, name: "Валерий Палыч", age: 65, group: "E:Постоянный",
		device: "Xiaomi Redmi 10",
		message: "На дачу на сезон: провод для бани 10м, автомат для бани 25А, светильник для бани влагозащищённый, розетка уличная, и фонарь на солнечной батарее если есть"
	},
	{
		id: 25, name: "Анна", age: 34, group: "E:Случайный",
		device: "iPhone 13",
		message: "Делаю ванную. Нужен светильник потолочный влагозащищённый, розетка с крышкой, вентилятор вытяжной тихий. Что есть и какие цены? В Леруа было дешевле кстати."
	},
];

// ─── ОТПРАВКА ЗАПРОСА ────────────────────────────────────
async function sendRequest(persona) {
	const searchStart = Date.now();
	const relevant = searchItems(persona.message);
	const catalogSubset = formatCatalogForAI(relevant);
	const searchTime = Date.now() - searchStart;

	const apiStart = Date.now();
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

		const response = await fetch(API_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: persona.message,
				history: [],
				catalog: catalogSubset,
			}),
			signal: controller.signal,
		});

		clearTimeout(timeout);
		const apiTime = Date.now() - apiStart;

		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			return {
				...persona,
				status: "ERROR",
				httpCode: response.status,
				searchTime,
				apiTime,
				error: errText,
				catalogSent: relevant.length,
			};
		}

		const data = await response.json();
		const text = data.text || "";

		// Анализ ответа
		const articlePattern = /[A-ZА-Яa-zа-я0-9]+-?[A-ZА-Яa-zа-я0-9\-./]+/g;
		const mentionedArticles = text.match(articlePattern) || [];
		const hasChips = /\[CHIPS:/.test(text);
		const wordCount = text.split(/\s+/).length;

		return {
			...persona,
			status: "OK",
			searchTime,
			apiTime,
			catalogSent: relevant.length,
			responseLength: text.length,
			wordCount,
			hasChips,
			mentionedArticles: mentionedArticles.length,
			text,
		};
	} catch (e) {
		return {
			...persona,
			status: "FAIL",
			searchTime,
			apiTime: Date.now() - apiStart,
			error: e.message,
			catalogSent: relevant.length,
		};
	}
}

// ─── ОТЧЁТ ───────────────────────────────────────────────
function printReport(results, totalTime) {
	console.log("═".repeat(80));
	console.log("  РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТА: 25 ПЕРСОН ОДНОВРЕМЕННО");
	console.log("═".repeat(80));
	console.log(`  Общее время: ${(totalTime / 1000).toFixed(1)} сек`);
	console.log(`  Каталог: ${items.length} товаров`);
	console.log(`  API: ${API_URL}`);
	console.log("═".repeat(80));

	// Таблица результатов
	console.log("\n┌─────┬─────────────────────┬──────────┬──────────┬────────┬────────┬──────────┬───────┐");
	console.log("│  #  │ Персона             │ Статус   │ API (с)  │ Поиск  │ Товары │ Ответ    │ CHIPS │");
	console.log("├─────┼─────────────────────┼──────────┼──────────┼────────┼────────┼──────────┼───────┤");

	const ok = [];
	const fail = [];

	for (const r of results) {
		const status = r.status === "OK" ? " OK " :
			r.status === "ERROR" ? `E${r.httpCode}` : "FAIL";
		const apiSec = (r.apiTime / 1000).toFixed(1);
		const searchMs = r.searchTime + "мс";
		const catalog = r.catalogSent || 0;
		const words = r.wordCount ? r.wordCount + "сл" : "-";
		const chips = r.hasChips ? "да" : r.status === "OK" ? "НЕТ" : "-";

		const nameStr = `${r.name}, ${r.age}`.padEnd(19);
		const statusStr = status.padEnd(8);
		const apiStr = (apiSec + "с").padEnd(8);
		const searchStr = searchMs.padEnd(6);
		const catStr = String(catalog).padEnd(6);
		const wordsStr = words.padEnd(8);
		const chipsStr = chips.padEnd(5);

		console.log(`│ ${String(r.id).padStart(2)}  │ ${nameStr} │ ${statusStr} │ ${apiStr} │ ${searchStr} │ ${catStr} │ ${wordsStr} │ ${chipsStr} │`);

		if (r.status === "OK") ok.push(r);
		else fail.push(r);
	}

	console.log("└─────┴─────────────────────┴──────────┴──────────┴────────┴────────┴──────────┴───────┘");

	// Статистика
	const apiTimes = ok.map(r => r.apiTime);
	const avgApi = apiTimes.length ? (apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length / 1000).toFixed(1) : "-";
	const minApi = apiTimes.length ? (Math.min(...apiTimes) / 1000).toFixed(1) : "-";
	const maxApi = apiTimes.length ? (Math.max(...apiTimes) / 1000).toFixed(1) : "-";
	const p95idx = Math.floor(apiTimes.sort((a, b) => a - b).length * 0.95);
	const p95 = apiTimes.length ? (apiTimes[p95idx] / 1000).toFixed(1) : "-";

	console.log("\n── СВОДКА ──────────────────────────────────────────────");
	console.log(`  Успех:    ${ok.length}/${results.length} (${(ok.length / results.length * 100).toFixed(0)}%)`);
	console.log(`  Ошибки:   ${fail.length}/${results.length}`);
	console.log(`  Время API — мин: ${minApi}с, сред: ${avgApi}с, макс: ${maxApi}с, P95: ${p95}с`);
	console.log(`  Общее время (все 25 параллельно): ${(totalTime / 1000).toFixed(1)}с`);

	if (fail.length > 0) {
		console.log("\n── ОШИБКИ ──────────────────────────────────────────────");
		for (const r of fail) {
			console.log(`  ${r.name}: ${r.status} ${r.httpCode || ""} — ${r.error}`);
		}
	}

	// Анализ ответов
	if (ok.length > 0) {
		const noChips = ok.filter(r => !r.hasChips);
		const shortResponses = ok.filter(r => r.wordCount < 20);
		const longResponses = ok.filter(r => r.wordCount > 200);
		const noArticles = ok.filter(r => r.mentionedArticles === 0);
		const lowCatalog = ok.filter(r => r.catalogSent < 5);

		console.log("\n── АНАЛИЗ КАЧЕСТВА ─────────────────────────────────────");
		if (noChips.length) console.log(`  Без CHIPS:          ${noChips.map(r => r.name).join(", ")}`);
		if (shortResponses.length) console.log(`  Слишком коротко:    ${shortResponses.map(r => r.name + "(" + r.wordCount + "сл)").join(", ")}`);
		if (longResponses.length) console.log(`  Слишком длинно:     ${longResponses.map(r => r.name + "(" + r.wordCount + "сл)").join(", ")}`);
		if (noArticles.length) console.log(`  Без артикулов:      ${noArticles.map(r => r.name).join(", ")}`);
		if (lowCatalog.length) console.log(`  Мало товаров в поиске: ${lowCatalog.map(r => r.name + "(" + r.catalogSent + ")").join(", ")}`);
	}

	// Оценка для клиентов
	console.log("\n── ОЦЕНКА ПО ТЕРПЕНИЮ КЛИЕНТА ──────────────────────────");
	const patienceThresholds = {
		"A:Профи": 8,     // профи ждут до 8 сек
		"B:Средний": 10,  // средние до 10 сек
		"C:Новичок": 6,   // новички нетерпеливы
		"D:Сложный": 5,   // сложные — минимум терпения
		"E:Постоянный": 8,
		"E:Случайный": 5,
	};

	for (const r of results) {
		const threshold = patienceThresholds[r.group] || 8;
		const apiSec = r.apiTime / 1000;
		const patience = apiSec <= threshold ? "Дождётся" :
			apiSec <= threshold * 1.5 ? "На грани" : "УЙДЁТ";
		const icon = patience === "Дождётся" ? "OK" :
			patience === "На грани" ? "!!" : "XX";
		if (patience !== "Дождётся") {
			console.log(`  [${icon}] ${r.name} (${r.group}): ${(apiSec).toFixed(1)}с > порог ${threshold}с — ${patience}`);
		}
	}

	const wouldLeave = results.filter(r => {
		const threshold = patienceThresholds[r.group] || 8;
		return r.apiTime / 1000 > threshold * 1.5;
	});
	const onEdge = results.filter(r => {
		const threshold = patienceThresholds[r.group] || 8;
		const sec = r.apiTime / 1000;
		return sec > threshold && sec <= threshold * 1.5;
	});
	const happy = results.length - wouldLeave.length - onEdge.length;

	console.log(`\n  Дождутся:   ${happy}/${results.length}`);
	console.log(`  На грани:   ${onEdge.length}/${results.length}`);
	console.log(`  Уйдут:     ${wouldLeave.length}/${results.length}`);

	// Детальные ответы (первые 100 символов)
	console.log("\n── ПРЕВЬЮ ОТВЕТОВ ──────────────────────────────────────");
	for (const r of results) {
		if (r.text) {
			const preview = r.text.replace(/\[CHIPS:.*\]/, "").trim().slice(0, 120);
			console.log(`  ${r.name}: ${preview}...`);
		} else {
			console.log(`  ${r.name}: [НЕТ ОТВЕТА] ${r.error || ""}`);
		}
	}
}

// ─── MAIN ────────────────────────────────────────────────
async function main() {
	console.log("=" .repeat(60));
	console.log("  НАГРУЗОЧНЫЙ ТЕСТ: 25 ПЕРСОН ОДНОВРЕМЕННО");
	console.log("=" .repeat(60));
	console.log(`\nPersoны: ${personas.length}`);
	console.log(`API: ${API_URL}`);
	console.log(`Таймаут: ${TIMEOUT_MS / 1000}с\n`);

	// Предварительный прогрев — один тестовый запрос
	console.log("Прогрев API (1 запрос)...");
	const warmup = await sendRequest({
		id: 0, name: "warmup", age: 0, group: "test",
		device: "test", message: "автомат 16А"
	});
	if (warmup.status !== "OK") {
		console.error(`\nОШИБКА: API не отвечает! ${warmup.error || warmup.httpCode}`);
		console.error("Проверьте что Yandex Cloud Function работает.");
		process.exit(1);
	}
	console.log(`  Прогрев OK: ${(warmup.apiTime / 1000).toFixed(1)}с\n`);

	// ОГОНЬ! Все 25 одновременно
	console.log(">>> ЗАПУСК ВСЕХ 25 ПЕРСОН ОДНОВРЕМЕННО >>>\n");
	const start = Date.now();
	const results = await Promise.all(personas.map(p => sendRequest(p)));
	const totalTime = Date.now() - start;

	printReport(results, totalTime);

	// Волновой тест
	console.log("\n\n" + "=".repeat(60));
	console.log("  ВОЛНОВОЙ ТЕСТ: 5 волн по 5 персон (интервал 2с)");
	console.log("=".repeat(60));

	const waves = [];
	for (let w = 0; w < 5; w++) {
		const wave = personas.slice(w * 5, w * 5 + 5);
		console.log(`\n  Волна ${w + 1}: ${wave.map(p => p.name).join(", ")}`);
		const waveStart = Date.now();
		const waveResults = await Promise.all(wave.map(p => sendRequest(p)));
		const waveTime = Date.now() - waveStart;
		const okCount = waveResults.filter(r => r.status === "OK").length;
		const avgTime = (waveResults.reduce((a, r) => a + r.apiTime, 0) / waveResults.length / 1000).toFixed(1);
		console.log(`    Результат: ${okCount}/5 OK, среднее ${avgTime}с, общее ${(waveTime / 1000).toFixed(1)}с`);
		waves.push({ wave: w + 1, results: waveResults, time: waveTime });

		if (w < 4) await new Promise(r => setTimeout(r, 2000));
	}

	console.log("\n── СРАВНЕНИЕ: ВСЕ РАЗОМ vs ВОЛНАМИ ─────────────────────");
	const allAtOnceAvg = (results.filter(r => r.status === "OK").reduce((a, r) => a + r.apiTime, 0) /
		results.filter(r => r.status === "OK").length / 1000).toFixed(1);
	const wavesAvg = (waves.flatMap(w => w.results).filter(r => r.status === "OK")
		.reduce((a, r) => a + r.apiTime, 0) /
		waves.flatMap(w => w.results).filter(r => r.status === "OK").length / 1000).toFixed(1);

	console.log(`  Все 25 разом — среднее время API: ${allAtOnceAvg}с`);
	console.log(`  Волнами по 5  — среднее время API: ${wavesAvg}с`);
	console.log(`  Разница: ${((allAtOnceAvg - wavesAvg) / wavesAvg * 100).toFixed(0)}%`);

	// ─── МЯГКИЙ СТРЕСС-ТЕСТ: НАРАСТАЮЩАЯ НАГРУЗКА ──────
	console.log("\n\n" + "=".repeat(60));
	console.log("  СТРЕСС-ТЕСТ: НАРАСТАЮЩАЯ НАГРУЗКА");
	console.log("  (останавливается при первых ошибках)");
	console.log("=".repeat(60));

	const stressMsg = { id: 0, name: "stress", age: 0, group: "test", device: "test", message: "автомат 16А IEK" };
	const levels = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50];
	let serverLimit = "50+";

	for (const concurrent of levels) {
		const batch = Array.from({ length: concurrent }, (_, i) => ({
			...stressMsg, id: i, name: `stress-${i + 1}`
		}));

		console.log(`\n  Нагрузка: ${concurrent} одновременных запросов...`);
		const batchStart = Date.now();
		const batchResults = await Promise.all(batch.map(p => sendRequest(p)));
		const batchTime = Date.now() - batchStart;

		const okCount = batchResults.filter(r => r.status === "OK").length;
		const failCount = batchResults.filter(r => r.status !== "OK").length;
		const times = batchResults.filter(r => r.status === "OK").map(r => r.apiTime);
		const avgMs = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0) : "-";
		const maxMs = times.length ? Math.max(...times) : 0;

		const errorRate = (failCount / concurrent * 100).toFixed(0);
		const bar = "█".repeat(Math.min(concurrent, 50));

		console.log(`    ${bar}`);
		console.log(`    OK: ${okCount}/${concurrent} | Ошибки: ${failCount} (${errorRate}%) | Сред: ${avgMs}мс | Макс: ${maxMs}мс | Общее: ${(batchTime / 1000).toFixed(1)}с`);

		// Остановка при проблемах
		if (failCount > concurrent * 0.3) {
			serverLimit = `~${concurrent} (${failCount} из ${concurrent} упали)`;
			console.log(`\n    СТОП: >30% ошибок при ${concurrent} запросах`);
			break;
		}
		if (maxMs > 25000) {
			serverLimit = `~${concurrent} (макс ответ ${(maxMs / 1000).toFixed(1)}с)`;
			console.log(`\n    СТОП: ответ >25с при ${concurrent} запросах`);
			break;
		}

		// Пауза между уровнями — даём серверу отдышаться
		await new Promise(r => setTimeout(r, 3000));
	}

	console.log("\n── ИТОГ СТРЕСС-ТЕСТА ───────────────────────────────────");
	console.log(`  Предел сервера: ${serverLimit} одновременных запросов`);
	console.log(`  `);
	console.log(`  Что это значит:`);
	console.log(`  - 1 планшет в зале: запас огромный`);
	console.log(`  - 5 планшетов: должно хватить`);
	console.log(`  - 10+ одновременных: зависит от результата выше`);

	console.log("\n" + "=".repeat(60));
	console.log("  ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ");
	console.log("=".repeat(60));
}

main().catch(console.error);
