/**
 * ZalAssist — Полная симуляция 25 персон
 * Многошаговые диалоги с реалистичным поведением
 *
 * Запуск: node scripts/persona-simulation.js
 */

import { readFileSync, writeFileSync } from "fs";
import MiniSearch from "minisearch";

// ─── КОНФИГ ──────────────────────────────────────────────
const API_URL = "https://functions.yandexcloud.net/d4e3bfsiqg0jbf7b99jg";
const TIMEOUT_MS = 30000;
const DELAY_BETWEEN_PERSONAS = 1500; // не DDoS-им
const DELAY_BETWEEN_STEPS = 1000;

// ─── КАТАЛОГ И ПОИСК (сокращённая копия) ─────────────────
const synonymGroups = [
	["дифавтомат", "авдт", "дифференциальный автомат"],
	["узо", "вд", "устройство защитного отключения"],
	["автомат", "ав", "автоматический выключатель"],
	["iek", "иек", "иэк"], ["schneider", "шнайдер"],
	["legrand", "легранд"], ["кабель", "провод"],
	["ввг", "ввгнг", "ввг-пнг"], ["розетка", "электророзетка"],
	["выключатель", "переключатель"], ["удлинитель", "переноска"],
	["лампа", "лампочка", "led лампа"], ["светильник", "люстра"],
	["щит", "щиток", "бокс"], ["дрель", "шуруповёрт"],
	["болгарка", "ушм"], ["гофра", "гофротруба"],
	["диммер", "светорегулятор"], ["прожектор", "led прожектор"],
	["bosch", "бош"], ["makita", "макита"],
	["контактор", "пускатель"], ["обогреватель", "конвектор"],
];

function buildSynonymMap(groups) {
	const map = new Map();
	for (const group of groups) {
		for (const term of group) {
			map.set(term, group.filter(t => t !== term));
		}
	}
	return map;
}

const synonymMap = buildSynonymMap(synonymGroups);
const cyrToLat = {
	"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e",
	"ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m",
	"н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u",
	"ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"shch",
	"ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"
};
function normalizeArticle(str) {
	return str.toLowerCase().split("").map(ch => cyrToLat[ch] ?? ch).join("")
		.replace(/[\s\-_./]+/g, "").replace(/[^a-z0-9]/g, "");
}

console.log("Загрузка каталога...");
const catalogData = JSON.parse(readFileSync("./static/catalog.json", "utf-8"));
const items = catalogData.items;
console.log(`  ${items.length} товаров`);

const enriched = items.map(item => ({ ...item, articleNorm: normalizeArticle(item.article || "") }));
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

function searchItems(query, limit = 50) {
	if (!query?.trim()) return [];
	return miniSearch.search(query.trim(), {
		boost: { articleNorm: 5, article: 3, name: 2, brand: 1.5, category: 1, description: 0.5 },
		fuzzy: 0.2, prefix: true, combineWith: "OR"
	}).map(r => items.find(i => i.id === r.id)).filter(Boolean).slice(0, limit);
}

function formatCatalogForAI(items) {
	return items.map(item =>
		`${item.article} | ${item.name} | ${item.category} | ${item.price || "?"} ₽ | ${item.inStock ? "да" : "нет"}`
	).join("\n");
}

// ─── АНАЛИЗ ОТВЕТА ──────────────────────────────────────
function analyzeResponse(text, catalog) {
	const clean = text.replace(/\[CHIPS:.*\]/s, "").trim();
	const wordCount = clean.split(/\s+/).length;
	const hasChips = /\[CHIPS:/.test(text);

	// Извлекаем артикулы из ответа
	const articleMatches = [];
	for (const item of catalog) {
		if (item.article && clean.toUpperCase().includes(item.article.toUpperCase())) {
			articleMatches.push(item);
		}
	}

	// Паттерны
	const asksQuestion = /\?/.test(clean);
	const saysNoStock = /нет в наличии|отсутств|нет в каталоге|нет в ассортименте|к сожалению.*нет/i.test(clean);
	const saysAskManager = /обратиться к консультанту|уточняйте у/i.test(clean);
	const asksTechnical = /цоколь|сечение|фаз|полюс|модул|номинал|тип установки|скрыт|открыт|одно.*фаз|трёх.*фаз/i.test(clean);
	const mentionsPrices = /\d+\s*₽|\d+\s*руб/i.test(clean);
	const listsProducts = articleMatches.length > 0;

	return {
		clean, wordCount, hasChips,
		articleCount: articleMatches.length,
		articles: articleMatches.map(a => a.article),
		asksQuestion, saysNoStock, saysAskManager,
		asksTechnical, mentionsPrices, listsProducts
	};
}

// ─── ОТПРАВКА ЗАПРОСА ────────────────────────────────────
async function sendChat(message, history) {
	const relevant = searchItems(message);
	// Добавляем товары из прошлых ответов
	const pastArticles = history.filter(m => m.role === "assistant").map(m => m.content).join(" ").toUpperCase();
	for (const item of items) {
		if (relevant.length >= 50) break;
		if (item.article && pastArticles.includes(item.article.toUpperCase())) {
			if (!relevant.find(r => r.id === item.id)) relevant.push(item);
		}
	}

	const catalogSubset = formatCatalogForAI(relevant);
	const start = Date.now();

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
		const response = await fetch(API_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message, history, catalog: catalogSubset }),
			signal: controller.signal,
		});
		clearTimeout(timeout);
		const elapsed = Date.now() - start;

		if (!response.ok) {
			return { ok: false, elapsed, error: `HTTP ${response.status}` };
		}
		const data = await response.json();
		return { ok: true, elapsed, text: data.text || "", catalogSent: relevant.length };
	} catch (e) {
		return { ok: false, elapsed: Date.now() - start, error: e.message };
	}
}

// ─── ЛОГИКА ВЫБОРА СЛЕДУЮЩЕГО СООБЩЕНИЯ ──────────────────
// Персона реагирует на ответ бота исходя из своего характера

function getFollowUp(persona, analysis, round) {
	const { asksQuestion, asksTechnical, saysNoStock, saysAskManager,
		listsProducts, wordCount, articleCount } = analysis;

	// Терпение закончилось
	if (round >= persona.patience) {
		return { action: "LEAVE", reason: "Терпение кончилось", message: null };
	}

	// Бот предложил товары — успех или продолжаем
	if (listsProducts && articleCount >= 2 && !asksQuestion) {
		if (persona.wantsMore) {
			return { action: "CONTINUE", reason: "Нашёл, но хочет ещё", message: persona.wantsMore };
		}
		return { action: "SUCCESS", reason: `Нашёл ${articleCount} товаров`, message: null };
	}

	// Бот предложил 1 товар и задаёт вопрос
	if (listsProducts && asksQuestion) {
		if (persona.followUps?.onProductQuestion) {
			return { action: "CONTINUE", reason: "Бот предложил и спросил", message: persona.followUps.onProductQuestion };
		}
	}

	// Бот задаёт техвопрос — персона знает или нет?
	if (asksTechnical) {
		if (persona.techLevel === "pro") {
			if (persona.followUps?.techAnswer) {
				return { action: "CONTINUE", reason: "Ответил на техвопрос", message: persona.followUps.techAnswer };
			}
		} else if (persona.techLevel === "mid") {
			if (persona.followUps?.techUnsure) {
				return { action: "CONTINUE", reason: "Не уверен в ответе", message: persona.followUps.techUnsure };
			}
		} else {
			// Новичок — не знает ответа
			if (persona.followUps?.techDontKnow) {
				return { action: "CONTINUE", reason: "Не знает ответ на техвопрос", message: persona.followUps.techDontKnow };
			}
			return { action: "LEAVE", reason: "Бот спросил то, что клиент не знает", message: null };
		}
	}

	// Бот задаёт уточняющий вопрос (не технический)
	if (asksQuestion && !asksTechnical) {
		if (persona.followUps?.onQuestion) {
			return { action: "CONTINUE", reason: "Отвечает на уточнение", message: persona.followUps.onQuestion };
		}
	}

	// Бот говорит нет в наличии
	if (saysNoStock) {
		if (persona.followUps?.onNoStock) {
			return { action: "CONTINUE", reason: "Нет в наличии, ищет альтернативу", message: persona.followUps.onNoStock };
		}
		return { action: "PARTIAL", reason: "Нет в наличии", message: null };
	}

	// Бот отправляет к менеджеру
	if (saysAskManager) {
		return { action: "LEAVE", reason: "Отправили к менеджеру", message: null };
	}

	// Слишком длинный ответ для нетерпеливых
	if (wordCount > 150 && persona.patience <= 3) {
		return { action: "LEAVE", reason: "Слишком длинный ответ, не читает", message: null };
	}

	// По умолчанию — продолжаем если есть что сказать
	if (persona.followUps?.default) {
		return { action: "CONTINUE", reason: "Продолжает диалог", message: persona.followUps.default };
	}

	return { action: "LEAVE", reason: "Не понял что делать дальше", message: null };
}

// ─── 25 ПЕРСОН С ДИАЛОГАМИ ──────────────────────────────
const personas = [
	// ───── ГРУППА A: ПРОФИ ─────
	{
		id: 1, name: "Михалыч", age: 55, group: "A:Профи",
		goal: "Закупка на объект: автоматы, кабель, УЗО",
		patience: 4, techLevel: "pro",
		initial: "ВА47-29 1P 16А — 6шт, ВВГнг 3х2.5 бухту, и УЗО 40А 30мА 2шт. Есть всё?",
		wantsMore: "Ещё нужны подрозетники 15шт, гофра 20мм 30м и клеммы WAGO 3-проводные пачку",
		followUps: {
			techAnswer: "Однополюсные, серия ВА47-29, характеристика С",
			onNoStock: "А аналоги есть? Можно EKF или CHINT",
			onQuestion: "На квартиру 60м2, трёхкомнатная, стандартная разводка",
			onProductQuestion: "Да, всё беру. Что ещё из мелочи нужно к этому?",
			default: "Это всё, давайте итого по списку"
		}
	},
	{
		id: 2, name: "Сергей", age: 35, group: "A:Профи",
		goal: "Замена щитка: АВДТ, автоматы, шины, гребёнка",
		patience: 5, techLevel: "pro",
		initial: "Мне АВДТ на 30мА, что есть? Шнайдер или IEK. И гребёнку 3P для них.",
		wantsMore: "Теперь щит на 24 модуля, шину нулевую и заземления, и маркировку для автоматов",
		followUps: {
			techAnswer: "2P, С16, 30мА, тип AC. Для розеточных групп",
			onNoStock: "А EKF есть? Или CHINT?",
			onQuestion: "Частный дом, 3 фазы, 15кВт выделенная мощность",
			onProductQuestion: "Покажи все АВДТ что есть, я сам выберу по параметрам",
			default: "Что по DIN-рейкам и шинам есть?"
		}
	},
	{
		id: 3, name: "Карина", age: 29, group: "A:Профи",
		goal: "Подбор розеток/выключателей под дизайн-проект",
		patience: 5, techLevel: "mid",
		initial: "Розетки и выключатели Legrand в бежевом цвете. Нужно 12 розеток, 8 выключателей двухклавишных, рамки двойные 6шт.",
		wantsMore: "А светорегулятор в этой же серии есть? И рамки на 3 поста?",
		followUps: {
			techUnsure: "Скрытый монтаж. Серия Valena Life если есть, или Inspiria",
			onNoStock: "А какие серии в бежевом есть вообще? Покажите все варианты",
			onQuestion: "Скрытая проводка, евростандарт. Главное чтобы вся серия была одинаковая",
			onProductQuestion: "Да, эти подойдут. А рамки к ним отдельно идут?",
			default: "Можно ещё посмотреть что есть в сером или серебристом?"
		}
	},
	{
		id: 4, name: "Ринат", age: 40, group: "A:Профи",
		goal: "Оптовый прайс на 30 позиций",
		patience: 4, techLevel: "pro",
		initial: "Прайс: автомат IEK 16А 20шт, автомат 25А 10шт, кабель ВВГнг 3х1.5 200м, ВВГнг 3х2.5 100м, УЗО 40А 30мА 5шт. Оптовая цена есть?",
		followUps: {
			techAnswer: "1P, характеристика С, ИЭК серия ВА47-29",
			onNoStock: "Аналоги от другого бренда, но чтоб цена не выше",
			onQuestion: "Всё однополюсное, характеристика С. Кабель круглый, не плоский",
			onProductQuestion: "Цены указаны розничные? У нас договор, скидка должна быть",
			default: "Ещё нужно: гофра 20мм 100м, клеммы WAGO 2-5 проводные по пачке, стяжки 200мм пакет"
		}
	},
	{
		id: 5, name: "Дмитрий", age: 31, group: "A:Профи",
		goal: "Быстрая закупка между объектами: 5 позиций",
		patience: 3, techLevel: "pro",
		initial: "Автомат 1P 32А, АВДТ 2P С25 30мА, клеммы WAGO 5-проводные пачку. Есть в наличии?",
		followUps: {
			techAnswer: "IEK или EKF, мне без разницы, главное чтоб было",
			onNoStock: "Ладно, а 25А автомат есть? И дифы какие есть на 25А?",
			onQuestion: "Любой бренд, что в наличии. Мне через 15 минут уезжать",
			default: "Всё, спасибо. Иду к прилавку"
		}
	},

	// ───── ГРУППА B: СРЕДНИЙ УРОВЕНЬ ─────
	{
		id: 6, name: "Максим", age: 30, group: "B:Средний",
		goal: "Собрать щиток для умного дома",
		patience: 5, techLevel: "mid",
		initial: "Хочу собрать щиток на 24 модуля для трёшки. Нужны автоматы на каждую линию, УЗО, и реле напряжения. Что посоветуете?",
		wantsMore: "А реле напряжения у вас есть? И контакторы для управления светом?",
		followUps: {
			techUnsure: "Ну стандартно: свет, розетки, кухня отдельно, стиралка отдельно, кондёр. Примерно 10-12 линий",
			onNoStock: "А что есть из реле? Хотя бы реле напряжения",
			onQuestion: "Квартира 85м2, три комнаты, кухня, два санузла. Хочу на каждую комнату отдельную линию",
			onProductQuestion: "А по автоматам — какие номиналы на какие линии ставить? Свет 10А, розетки 16А?",
			default: "Сколько модулей всего получится? Щит на 24 хватит?"
		}
	},
	{
		id: 7, name: "Елена", age: 38, group: "B:Средний",
		goal: "Розетки и выключатели для кухни — сравнить варианты",
		patience: 5, techLevel: "low",
		initial: "Какие серии розеток у вас есть? Мне для кухни белые, минимум 6 штук и выключатели в той же серии. Покажите все варианты по цене.",
		wantsMore: "А рамки к ним нужны отдельно? Покажите рамки для этой серии",
		followUps: {
			techDontKnow: "С заземлением наверное. Обычные, в стену. Не знаю какой монтаж, у нас стандартный ремонт",
			onNoStock: "А что есть в белом? Покажите самые популярные",
			onQuestion: "Белые, обычные, для кухни. С заземлением. Встраиваемые в стену",
			onProductQuestion: "А чем эти отличаются от тех? Какие надёжнее?",
			default: "А какие вы бы сами себе поставили?"
		}
	},
	{
		id: 8, name: "Андрей", age: 48, group: "B:Средний",
		goal: "Офис 200м² — свет и розетки, быстро",
		patience: 3, techLevel: "mid",
		initial: "Офис 200м2, нужно: панели светодиодные потолочные, розетки 20шт, автоматы. Всё сразу, быстро. Что по деньгам?",
		followUps: {
			techUnsure: "Армстронг потолок, розетки обычные белые, автоматы на сколько надо для такого офиса",
			onNoStock: "А что есть из панелей? Любые квадратные 600х600",
			onQuestion: "Потолок Армстронг, 200 квадратов. 10 кабинетов примерно. Розетки по 2 на кабинет плюс коридор",
			default: "Итого сколько выходит? Мне надо бюджет прикинуть"
		}
	},
	{
		id: 9, name: "Виктор", age: 42, group: "B:Средний",
		goal: "Ванная под ключ: проводка, свет, розетки, защита",
		patience: 4, techLevel: "mid",
		initial: "Делаю ванную. Нужна проводка: кабель, автомат, светильник влагозащищённый, розетка для ванной, вентилятор вытяжной. Что брать?",
		wantsMore: "Ещё нужен кабель-канал или гофра для ванной и подрозетники для плитки",
		followUps: {
			techUnsure: "Ну обычная ванная, не джакузи. Стиралка будет, бойлер нет. Розетка одна для стиралки и фен",
			onNoStock: "Что есть из влагозащищённого? IP44 хотя бы",
			onQuestion: "Стандартная ванная 4м2. Стиралка, свет на потолке, розетка для фена и стиралки",
			onProductQuestion: "А кабель какой именно нужен для ванной? Обычный ВВГнг подойдёт?",
			default: "А дифавтомат на ванную нужен отдельный?"
		}
	},
	{
		id: 10, name: "Даша и Костя", age: 28, group: "B:Средний",
		goal: "Первый ремонт, однушка — вся электрика с нуля",
		patience: 5, techLevel: "low",
		initial: "Первый ремонт, однушка. Нужна вся электрика с нуля — щиток, автоматы, кабель, розетки, выключатели. С чего начать и что купить?",
		wantsMore: "А розетки и выключатели? Сколько нужно на однушку? И какие серии недорогие но нормальные?",
		followUps: {
			techDontKnow: "Мы не знаем. Квартира 38м2, однушка, стандартная. Что обычно ставят?",
			onNoStock: "А что из этого в наличии прямо сейчас?",
			onQuestion: "Однушка 38м2, кухня 8м2, комната, коридор, санузел. Стиралка, плита электрическая, кондёр планируем",
			onProductQuestion: "Мы первый раз делаем ремонт, можете просто список дать что купить?",
			default: "А это безопасно всё? Мы боимся с электрикой сами"
		}
	},

	// ───── ГРУППА C: НОВИЧКИ ─────
	{
		id: 11, name: "Ольга", age: 62, group: "C:Новичок",
		goal: "Свет на дачу: веранда + лампочки + автомат",
		patience: 4, techLevel: "low",
		initial: "Значит у меня дача, дом старый. Нужен свет на веранду чтоб не моргал и автомат чтоб не выбивало. И лампочки тёплые 3 штуки. Посоветуйте.",
		followUps: {
			techDontKnow: "Я не знаю какой цоколь, обычная лампочка, вкручивается. Большая, не маленькая",
			onNoStock: "А что есть? Мне любой, главное чтоб работал",
			onQuestion: "Веранда открытая, дом деревянный, проводка старая. Нужно чтоб безопасно было",
			onProductQuestion: "А мне это подойдёт? Я боюсь не то купить",
			default: "Спасибо, а это всё мне поможет установить менеджер?"
		}
	},
	{
		id: 12, name: "Марина", age: 45, group: "C:Новичок",
		goal: "Купить список от мужа (с ошибками)",
		patience: 3, techLevel: "low",
		initial: "Муж скинул: афтамат iek 20а 2шт, удленитель 5м, лампы тёпл 10вт 5шт, розетка двойная наружная, изолента. Это всё есть у вас?",
		followUps: {
			techDontKnow: "Я не знаю, муж написал. Сейчас ему позвоню... а может сами подберёте?",
			onNoStock: "А что из списка есть? Хотя бы что-то?",
			onQuestion: "Я не знаю, вот что муж написал то и нужно. Один к одному",
			default: "Окей спасибо, а где это всё в магазине найти?"
		}
	},
	{
		id: 13, name: "Артём", age: 20, group: "C:Новичок",
		goal: "Починить розетку дёшево + удлинитель",
		patience: 3, techLevel: "low",
		initial: "Розетка искрит, надо поменять. Что самое дешёвое? И удлинитель нормальный метра 3.",
		followUps: {
			techDontKnow: "Не знаю какая, обычная белая, в стене. Квартира съёмная",
			onNoStock: "А что самое дешёвое из того что есть?",
			onQuestion: "В стене, обычная, одинарная. Мне лишь бы работало и дёшево",
			default: "А отвёртка нужна чтобы поменять? Какая самая дешёвая?"
		}
	},
	{
		id: 14, name: "Людмила Сергеевна", age: 52, group: "C:Новичок",
		goal: "Закупка для школы по смете: светильники, лампы, выключатели",
		patience: 4, techLevel: "low",
		initial: "Закупка для школы по смете: светильники потолочные 20шт, лампы LED 30шт, выключатели 10шт. Нужно уложиться в 45 тысяч. Что подберёте?",
		followUps: {
			techDontKnow: "Потолки обычные побеленные, светильники накладные нужны. Лампы обычные, большие. Выключатели одноклавишные белые",
			onNoStock: "А что есть из бюджетного? Мне главное в смету уложиться",
			onQuestion: "Классы школьные, потолки 3 метра, обычные. Нужно яркое освещение по нормам",
			onProductQuestion: "А это всё в 45 тысяч влезет? Посчитайте пожалуйста",
			default: "Мне ещё нужно будет документы для бухгалтерии. Это к менеджеру?"
		}
	},
	{
		id: 15, name: "Саня", age: 37, group: "C:Новичок",
		goal: "Удлинитель и изолента — быстро и уехать",
		patience: 2, techLevel: "low",
		initial: "Удлинитель 5 метров и изолента. Быстро.",
		followUps: {
			onQuestion: "Любой. Нормальный. С заземлением. Мне через 5 минут уезжать",
			default: "Всё, нашёл, спасибо"
		}
	},

	// ───── ГРУППА D: СЛОЖНЫЕ ─────
	{
		id: 16, name: "Николай Петрович", age: 72, group: "D:Сложный",
		goal: "Лампочки по всей квартире — 6шт разных",
		patience: 3, techLevel: "low",
		initial: "здраствуйте мне нужны лампочки обычные для люстры 3 штуки и на кухню 2 штуки и в коридор одну. как раньше были только яркие",
		followUps: {
			techDontKnow: "я не знаю какой цоколь. обычная лампочка. которая вкручивается. круглая. можно позвать продавца?",
			onNoStock: "а обычные то лампочки есть хоть какие?",
			onQuestion: "в люстру большие, на кухню тоже. в коридоре маленький патрон такой узкий",
			default: "спасибо а где их найти в магазине?"
		}
	},
	{
		id: 17, name: "Валентина Ивановна", age: 78, group: "D:Сложный",
		goal: "Купить по записке от внука: 5 позиций",
		patience: 3, techLevel: "low",
		initial: "тут написано от внука: дифф авт С16 30мА 1шт, узо 40А 30мА 2шт, автомат С10 4шт. я не знаю что это помогите пожалуйста",
		followUps: {
			techDontKnow: "я не знаю милочка, тут так написано. внук сказал купить. однофазный или нет я не знаю, дом обычный квартира",
			onNoStock: "а что делать? внук сказал именно это купить. может позвоните ему?",
			onQuestion: "квартира обычная, двухкомнатная. внук сказал вот этот список. я ничего в этом не понимаю",
			default: "а вы можете собрать всё в пакетик и я оплачу?"
		}
	},
	{
		id: 18, name: "Азиз", age: 33, group: "D:Сложный",
		goal: "Кабель, автоматы, розетки для стройки — дёшево",
		patience: 3, techLevel: "mid",
		initial: "привет мне нада провод для стройка 100 метр самый толстый и автомат 25 ампер десять штук и розетка двадцать штук самый дешёвый",
		followUps: {
			techUnsure: "провод для электричество. толстый. 2.5 или 4 квадрат. какой дешевле",
			onNoStock: "тогда что есть? мне надо много, дешёвый",
			onQuestion: "для стройка, дом строим. три этаж. электричество 380 вольт",
			default: "окей. сколько всё стоит? надо дешёво"
		}
	},
	{
		id: 19, name: "Алина", age: 19, group: "D:Сложный",
		goal: "Розетки и выключатели под эстетику + ночник",
		patience: 4, techLevel: "low",
		initial: "есть розетки в бежевом?? чтоб прям минимализм без рамок страшных. и выключатель такой же. и ночник может какой красивый",
		followUps: {
			techDontKnow: "не знаю какой монтаж, в стене. обычная квартира. мне главное чтоб красиво",
			onNoStock: "а вообще красивые розетки какие есть? может в белом тогда но чтоб не совковые",
			onQuestion: "комната, стены бежевые. розетки 4 штуки, выключатель один двойной, и ночник в розетку",
			onProductQuestion: "а фото реальное? а то на сайтах всегда красивее чем в жизни",
			default: "а можно в инсте посмотреть как в интерьере смотрится?"
		}
	},
	{
		id: 20, name: "Кирилл", age: 16, group: "D:Сложный",
		goal: "Купить 4 позиции по списку от мамы",
		patience: 2, techLevel: "low",
		initial: "выкл 2клав бел",
		followUps: {
			onQuestion: "я не знаю мама сказала выключатель двухклавишный белый",
			techDontKnow: "не знаю, обычный. белый. в стену",
			default: "ещё розетка тройная, лампочка 10вт 4шт, удлинитель 3м"
		}
	},

	// ───── ГРУППА E: ПОСТОЯННЫЕ / СЛУЧАЙНЫЕ ─────
	{
		id: 21, name: "Игорь", age: 44, group: "E:Постоянный",
		goal: "Еженедельный список на 40 позиций для УК",
		patience: 4, techLevel: "pro",
		initial: "Список на неделю: автомат 1P 16А 10шт, автомат 1P 25А 5шт, УЗО 2P 40А/30мА 3шт, кабель ВВГнг 3х1.5 100м, кабель 3х2.5 50м, розетки 20шт, выключатели 10шт",
		wantsMore: "Ещё: патроны E27 10шт, лампы LED 10Вт 20шт, изолента 10шт, стяжки 200мм 5 пачек, дюбель-гвоздь 6х40 2 пачки",
		followUps: {
			techAnswer: "IEK, серия ВА47-29, характеристика С. Розетки любые белые встраиваемые",
			onNoStock: "Что есть — давайте. Остальное Наташе скину, она закажет",
			onQuestion: "IEK всё, характеристика С. Розетки белые скрытые. Выключатели одноклавишные белые",
			default: "По ценам итого сколько? Мне для заявки нужно"
		}
	},
	{
		id: 22, name: "Руслан", age: 39, group: "E:Постоянный",
		goal: "Смета на электрику квартиры 80м²",
		patience: 4, techLevel: "pro",
		initial: "Объект: квартира 80м2. Нужна смета на электрику: щит, автоматика, кабель, розетки-выключатели. Бюджет до 150 тысяч. Счёт с НДС можно?",
		followUps: {
			techAnswer: "3 комнаты, кухня, 2 санузла, коридор. 20 розеточных групп, 8 световых. Щит на 36 модулей",
			onNoStock: "Подберите из того что есть, мне главное в бюджет войти",
			onQuestion: "Трёшка: 3 комнаты, кухня, 2 санузла. Плита электрическая, кондёр, стиралка, посудомойка",
			default: "Итого сколько получается? И счёт с НДС можете сделать?"
		}
	},
	{
		id: 23, name: "Дядя Женя", age: 58, group: "E:Постоянный",
		goal: "Посмотреть новинки, может что купить",
		patience: 5, techLevel: "mid",
		initial: "Что нового из Шнайдера у вас появилось? И автоматы Legrand завезли наконец?",
		wantsMore: "А покажи что из LED-панелей есть, хочу в гараже свет поменять",
		followUps: {
			techUnsure: "Мне просто интересно что нового. Я 12 лет у вас покупаю, люблю в курсе быть",
			onNoStock: "Жалко. А когда ждёте завоз? Скажите Серёге чтоб заказал",
			onQuestion: "Не, ничего конкретного не ищу. Просто посмотреть что появилось",
			default: "А из инструмента что-нибудь новое есть? Makita или Bosch?"
		}
	},
	{
		id: 24, name: "Валерий Палыч", age: 65, group: "E:Постоянный",
		goal: "Список на дачный сезон: баня + улица",
		patience: 4, techLevel: "mid",
		initial: "На дачу на сезон: провод для бани 10м, автомат для бани 25А, светильник для бани влагозащищённый, розетка уличная, и фонарь на солнечной батарее если есть",
		wantsMore: "А ещё мне в прошлом году хороший прожектор светодиодный брал. Есть такие же? На 50 ватт примерно",
		followUps: {
			techUnsure: "Провод термостойкий нужен, для бани. Сечение 2.5 наверное хватит",
			onNoStock: "Жаль. А в прошлом году были, помню. Может аналог какой?",
			onQuestion: "Баня деревянная, парилка и предбанник. Свет в предбаннике и на улице у входа. Электричество от дома проведено",
			default: "Спасибо! Я сезон закрою этим. Серёге привет!"
		}
	},
	{
		id: 25, name: "Анна", age: 34, group: "E:Случайный",
		goal: "Ванная: светильник + розетка + вентилятор, сравнить с Леруа",
		patience: 4, techLevel: "low",
		initial: "Делаю ванную. Нужен светильник потолочный влагозащищённый, розетка с крышкой, вентилятор вытяжной тихий. Что есть и какие цены? В Леруа было дешевле кстати.",
		followUps: {
			techDontKnow: "IP44 наверное. Не знаю точно. Чтоб от воды не сломался",
			onNoStock: "А что вообще есть для ванной? Хоть что-то влагозащищённое?",
			onQuestion: "Ванная стандартная, потолок натяжной. Светильник встраиваемый или накладной — без разницы",
			onProductQuestion: "А по качеству это нормально? А то в Леруа отзывы были не очень на дешёвые",
			default: "Окей, а вентилятор у вас есть тихий? В Леруа Эра Silent за 2000 был"
		}
	}
];

// ─── ЗАПУСК СИМУЛЯЦИИ ОДНОЙ ПЕРСОНЫ ──────────────────────
async function simulatePersona(persona) {
	const log = [];
	const history = [];
	let result = "UNKNOWN";
	let resultReason = "";
	let totalApiTime = 0;

	log.push(`\n${"─".repeat(60)}`);
	log.push(`ПЕРСОНА: ${persona.name}, ${persona.age} лет (${persona.group})`);
	log.push(`ЦЕЛЬ: ${persona.goal}`);
	log.push(`ТЕРПЕНИЕ: ${persona.patience} раундов`);
	log.push(`${"─".repeat(60)}`);

	// Раунд 1: начальное сообщение
	let currentMessage = persona.initial;
	let round = 0;

	while (currentMessage && round < persona.patience + 1) {
		round++;
		log.push(`\n  [Клиент, раунд ${round}]: ${currentMessage}`);

		const response = await sendChat(currentMessage, history);
		totalApiTime += response.elapsed;

		if (!response.ok) {
			log.push(`  [ОШИБКА]: ${response.error} (${response.elapsed}мс)`);
			result = "ERROR";
			resultReason = response.error;
			break;
		}

		const analysis = analyzeResponse(response.text, items);
		log.push(`  [Бот, ${(response.elapsed / 1000).toFixed(1)}с, ${analysis.wordCount}сл, ${analysis.articleCount} арт.]: ${analysis.clean.slice(0, 200)}${analysis.clean.length > 200 ? "..." : ""}`);

		// Добавляем в историю
		history.push({ role: "user", content: currentMessage });
		history.push({ role: "assistant", content: response.text });

		// Определяем следующий шаг
		const followUp = getFollowUp(persona, analysis, round);
		log.push(`  [Оценка]: ${followUp.reason} → ${followUp.action}`);

		if (followUp.action === "SUCCESS") {
			result = "SUCCESS";
			resultReason = followUp.reason;

			// Если есть wantsMore — продолжаем
			if (persona.wantsMore && round <= 2) {
				log.push(`  [Клиент хочет ещё товаров]`);
				currentMessage = persona.wantsMore;
				persona.wantsMore = null; // использовали
				continue;
			}
			break;
		} else if (followUp.action === "PARTIAL") {
			result = "PARTIAL";
			resultReason = followUp.reason;
			break;
		} else if (followUp.action === "LEAVE") {
			result = "LEAVE";
			resultReason = followUp.reason;
			break;
		} else if (followUp.action === "CONTINUE") {
			currentMessage = followUp.message;
		}

		await new Promise(r => setTimeout(r, DELAY_BETWEEN_STEPS));
	}

	if (result === "UNKNOWN") {
		result = round >= persona.patience ? "LEAVE" : "PARTIAL";
		resultReason = "Исчерпано количество раундов";
	}

	const icon = { SUCCESS: "OK", PARTIAL: "~~", LEAVE: "XX", ERROR: "!!" }[result] || "??";
	log.push(`\n  [${icon}] ИТОГ: ${result} — ${resultReason}`);
	log.push(`  Раундов: ${round}, Общее время API: ${(totalApiTime / 1000).toFixed(1)}с`);

	return {
		id: persona.id, name: persona.name, age: persona.age, group: persona.group,
		goal: persona.goal, result, reason: resultReason,
		rounds: round, totalApiTime, log: log.join("\n")
	};
}

// ─── ФИНАЛЬНЫЙ ОТЧЁТ ────────────────────────────────────
function printFinalReport(results) {
	console.log("\n\n" + "═".repeat(70));
	console.log("  ИТОГОВЫЙ ОТЧЁТ: СИМУЛЯЦИЯ 25 ПЕРСОН");
	console.log("═".repeat(70));

	// Таблица
	console.log("\n┌────┬──────────────────────┬───────────┬──────────┬────────┬─────────────────────────────────┐");
	console.log("│ #  │ Персона              │ Результат │ Раундов  │ Время  │ Причина                         │");
	console.log("├────┼──────────────────────┼───────────┼──────────┼────────┼─────────────────────────────────┤");

	for (const r of results) {
		const icon = { SUCCESS: " OK ", PARTIAL: " ~~ ", LEAVE: " XX ", ERROR: " !! " }[r.result];
		const name = `${r.name}, ${r.age}`.padEnd(20);
		const res = icon.padEnd(9);
		const rounds = String(r.rounds).padEnd(8);
		const time = ((r.totalApiTime / 1000).toFixed(1) + "с").padEnd(6);
		const reason = r.reason.slice(0, 31).padEnd(31);
		console.log(`│ ${String(r.id).padStart(2)} │ ${name} │ ${res} │ ${rounds} │ ${time} │ ${reason} │`);
	}
	console.log("└────┴──────────────────────┴───────────┴──────────┴────────┴─────────────────────────────────┘");

	// Статистика
	const success = results.filter(r => r.result === "SUCCESS");
	const partial = results.filter(r => r.result === "PARTIAL");
	const leave = results.filter(r => r.result === "LEAVE");
	const error = results.filter(r => r.result === "ERROR");

	console.log("\n── КОНВЕРСИЯ ───────────────────────────────────────────");
	console.log(`  OK  Полный успех:      ${success.length}/${results.length} (${(success.length / results.length * 100).toFixed(0)}%) — ${success.map(r => r.name).join(", ") || "—"}`);
	console.log(`  ~~  Частичный успех:   ${partial.length}/${results.length} (${(partial.length / results.length * 100).toFixed(0)}%) — ${partial.map(r => r.name).join(", ") || "—"}`);
	console.log(`  XX  Ушёл:             ${leave.length}/${results.length} (${(leave.length / results.length * 100).toFixed(0)}%) — ${leave.map(r => r.name).join(", ") || "—"}`);
	if (error.length) console.log(`  !!  Ошибка:           ${error.length}/${results.length} — ${error.map(r => r.name).join(", ")}`);

	// По группам
	console.log("\n── ПО ГРУППАМ ──────────────────────────────────────────");
	const groups = [...new Set(results.map(r => r.group))];
	for (const group of groups) {
		const gr = results.filter(r => r.group === group);
		const grOk = gr.filter(r => r.result === "SUCCESS").length;
		console.log(`  ${group}: ${grOk}/${gr.length} успех (${(grOk / gr.length * 100).toFixed(0)}%)`);
	}

	// Причины ухода
	if (leave.length > 0) {
		console.log("\n── ПОЧЕМУ УШЛИ ─────────────────────────────────────────");
		for (const r of leave) {
			console.log(`  ${r.name}: ${r.reason}`);
		}
	}

	// Топ проблем
	console.log("\n── ТОП ПРОБЛЕМ ─────────────────────────────────────────");
	const problems = {};
	for (const r of results) {
		if (r.result !== "SUCCESS") {
			const key = r.reason;
			if (!problems[key]) problems[key] = [];
			problems[key].push(r.name);
		}
	}
	const sorted = Object.entries(problems).sort((a, b) => b[1].length - a[1].length);
	for (const [reason, names] of sorted) {
		console.log(`  [${names.length}x] ${reason}: ${names.join(", ")}`);
	}

	// Время
	const totalTime = results.reduce((a, r) => a + r.totalApiTime, 0);
	console.log(`\n── ВРЕМЯ ───────────────────────────────────────────────`);
	console.log(`  Общее время API: ${(totalTime / 1000).toFixed(1)}с`);
	console.log(`  Среднее на персону: ${(totalTime / results.length / 1000).toFixed(1)}с`);
	console.log(`  Среднее на раунд: ${(totalTime / results.reduce((a, r) => a + r.rounds, 0) / 1000).toFixed(1)}с`);
}

// ─── MAIN ────────────────────────────────────────────────
async function main() {
	console.log("═".repeat(60));
	console.log("  ПОЛНАЯ СИМУЛЯЦИЯ: 25 ПЕРСОН, МНОГОШАГОВЫЕ ДИАЛОГИ");
	console.log("═".repeat(60));
	console.log(`  Персон: ${personas.length}`);
	console.log(`  API: ${API_URL}`);
	console.log(`  Задержка между персонами: ${DELAY_BETWEEN_PERSONAS}мс`);
	console.log(`  Задержка между шагами: ${DELAY_BETWEEN_STEPS}мс\n`);

	const allResults = [];

	// Запускаем по 5 параллельно (не перегружаем сервер)
	for (let batch = 0; batch < personas.length; batch += 5) {
		const group = personas.slice(batch, batch + 5);
		console.log(`\n>>> Группа ${Math.floor(batch / 5) + 1}/5: ${group.map(p => p.name).join(", ")}`);

		const results = await Promise.all(group.map(p => simulatePersona(p)));

		for (const r of results) {
			allResults.push(r);
			console.log(r.log);
		}

		if (batch + 5 < personas.length) {
			console.log(`\n  --- Пауза ${DELAY_BETWEEN_PERSONAS}мс перед следующей группой ---`);
			await new Promise(r => setTimeout(r, DELAY_BETWEEN_PERSONAS));
		}
	}

	printFinalReport(allResults);

	// Сохраняем подробный лог
	const logText = allResults.map(r => r.log).join("\n\n");
	const reportPath = "./scripts/simulation-report.txt";
	writeFileSync(reportPath, logText, "utf-8");
	console.log(`\n  Подробный лог сохранён: ${reportPath}`);

	console.log("\n" + "═".repeat(60));
	console.log("  СИМУЛЯЦИЯ ЗАВЕРШЕНА");
	console.log("═".repeat(60));
}

main().catch(console.error);
