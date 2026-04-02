---
phase: 2
plan: search-engine
wave: 1
requires: []
req_ids: [SEARCH-01, SEARCH-02, SEARCH-03]
status: pending
---

# Plan: Поисковый движок (MiniSearch + синонимы + нормализация)

## Objective

Создать клиентский поисковый движок на MiniSearch с нормализацией артикулов, словарем синонимов электротехники и fuzzy matching по кириллице. Движок экспортирует единый API `createSearchEngine(items)` для использования в UI.

## Context

- Каталог: `static/catalog.json` — 74 товара, формат item: `{ id, article, name, category, subcategory, brand, description, specs, inStock, unit }`
- Загрузка: `src/lib/data/catalog.js` — `loadCatalog()` возвращает `{ lastUpdated, items }`, не менять
- Svelte 5 runes, файлы `.js` (не `.ts`), все импорты через `$app/paths` base
- MiniSearch v7: `processTerm` может возвращать массив для индексации синонимов
- Нормализация артикулов: кириллица -> латиница, убрать дефисы/пробелы, отдельное поле `articleNorm`
- `trailingSlash: "always"` в проекте

## Tasks

### Task 1: Установить MiniSearch

**What:** Добавить `minisearch` как dependency в package.json
**Where:** `c:/Users/ikoko/Projects/ZalAssist/package.json`
**How:**
```bash
cd c:/Users/ikoko/Projects/ZalAssist && npm install minisearch
```
**Done when:** `grep "minisearch" c:/Users/ikoko/Projects/ZalAssist/package.json` находит запись в dependencies

### Task 2: Создать модуль нормализации артикулов

**What:** Функция `normalizeArticle(str)` — транслитерация кириллица->латиница, убирание дефисов/пробелов/спецсимволов, lowercase. Функция `isArticleLike(query)` — проверка наличия цифр в строке.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/search/normalize.js`
**How:**
Создать файл с содержимым:

```javascript
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
```

**Done when:** Файл `src/lib/search/normalize.js` существует и содержит `export function normalizeArticle`

### Task 3: Создать словарь синонимов электротехники

**What:** Массив `synonymGroups` с минимум 25 группами синонимов + функция `buildSynonymMap(groups)` для построения lookup Map.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/search/synonyms.js`
**How:**
Создать файл с полным словарем из RESEARCH.md (раздел "Словарь синонимов электротехники"). Группы:
- Устройства защиты: дифавтомат/авдт, узо/вд, автомат/ав, рубильник/разъединитель
- Бренды: iek/иек/иэк, abb/абб, ekf/экф, tdm/тдм, legrand/легранд
- Кабель: кабель/провод, ввг/ввгнг, гофра/гофротруба, кабель-канал/короб
- Электроустановка: розетка, выключатель/переключатель, проходной
- Щиты: щит/щиток/бокс, навесной/наружный, встраиваемый/внутренний
- Освещение: лампа/лампочка/led лампа, светильник/люстра, панель/армстронг, прожектор
- Единицы: ампер/а/amp, ватт/вт/w

Функция `buildSynonymMap` возвращает `Map<string, string[]>` где ключ — термин, значение — массив его синонимов (без самого термина).

**Done when:** `grep "synonymGroups" c:/Users/ikoko/Projects/ZalAssist/src/lib/search/synonyms.js` находит экспорт

### Task 4: Создать поисковый движок

**What:** Функция `createSearchEngine(items)` — инициализирует MiniSearch, индексирует товары с синонимами и нормализованными артикулами, возвращает объект `{ search(query, limit?), suggest(query), getFallback(query, allItems) }`.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/search/engine.js`
**How:**
Создать файл по образцу из RESEARCH.md (раздел "Полный поисковый модуль"). Ключевые аспекты:
- `idField: "id"`, `fields: ["articleNorm", "article", "name", "description", "category", "brand"]`
- `storeFields`: все поля товара (id, article, name, category, subcategory, brand, description, specs, inStock, unit)
- `tokenize`: разбивка по `[\s\-_.,;:!?()/]+`, lowercase
- `processTerm`: lookup в synonymMap, возврат `[lower, ...synonyms]` или `lower`
- `search()`: boost articleNorm:5, article:3, name:2, brand:1.5, category:1, description:0.5; fuzzy:0.2, prefix:true, combineWith:"OR". Дополнительный поиск нормализованным артикулом если `isArticleLike(query)`. Merge + deduplicate по id, limit 15.
- `suggest()`: `miniSearch.autoSuggest()` с fuzzy:0.2, prefix:true, limit 5
- `getFallback()`: попробовать каждое слово запроса отдельно с fuzzy:0.3; если ничего — вернуть 5 случайных товаров

Вспомогательная функция `mergeResults(a, b)` — объединение результатов, дедупликация по id, сохранение max score, сортировка по score desc.

**Done when:** `grep "export function createSearchEngine" c:/Users/ikoko/Projects/ZalAssist/src/lib/search/engine.js` находит экспорт

## Tests Required

- Вручную: `normalizeArticle("ВА47-29 1P 16А")` === `"va47291p16a"`
- Вручную: `normalizeArticle("BA47-29-1P-16A")` === `"ba47291p16a"`
- Вручную: `buildSynonymMap([["дифавтомат", "авдт"]]).get("дифавтомат")` содержит `"авдт"`
- После интеграции (Wave 2): поиск "дифавтомат" находит товары с "АВДТ" в названии
- После интеграции: поиск "ВА47-29 1P 16А" находит товар с артикулом "BA47-29-1P-16A"

## Definition of Done

- [ ] `minisearch` в dependencies package.json
- [ ] Файл `src/lib/search/normalize.js` существует, экспортирует `normalizeArticle` и `isArticleLike`
- [ ] Файл `src/lib/search/synonyms.js` существует, экспортирует `synonymGroups` (минимум 25 групп) и `buildSynonymMap`
- [ ] Файл `src/lib/search/engine.js` существует, экспортирует `createSearchEngine`
- [ ] `npm run build` завершается без ошибок
