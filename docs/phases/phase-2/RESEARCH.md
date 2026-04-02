# Phase Research: Поиск по каталогу

**Phase:** 2 — Поиск по каталогу
**Date:** 2026-04-02

## Scope

Исследованы конкретные паттерны реализации клиентского поиска по каталогу 74 товаров: настройка MiniSearch с кириллицей и fuzzy, нормализация артикулов, словарь синонимов электротехники, bottom sheet через DaisyUI modal, Clipboard API с fallback для iOS Safari, работа с query params в SvelteKit 2 + Svelte 5 runes.

## Codebase Audit Findings

### Existing Patterns to Follow

| Pattern | Example Location | Rule for Planner |
|---------|-----------------|------------------|
| Svelte 5 runes ($state, $derived, $props) | src/routes/+page.svelte | НЕ использовать stores, $:, let для реактивных переменных |
| `import { base } from "$app/paths"` во всех ссылках | src/routes/+page.svelte, src/lib/data/catalog.js | Все href и fetch обязательно через base |
| DaisyUI классы (btn, card, badge, input, modal) | src/routes/+page.svelte | Использовать DaisyUI компоненты, не писать свой CSS |
| Lucide-svelte для иконок | src/routes/+page.svelte | `import { Icon } from "lucide-svelte"` |
| Layout минимальный, без навигации | src/routes/+layout.svelte | Layout только подключает CSS и meta |
| prerender + trailingSlash | src/routes/+layout.js | Статический сайт, все страницы prerenderятся |
| Кэш каталога в модуле | src/lib/data/catalog.js | Один fetch, дальше из памяти |
| Чипсы категорий как badge | src/routes/+page.svelte | badge badge-outline badge-lg |
| Файлы .js (не .ts) | весь проект | JavaScript, не TypeScript |

### Files This Phase Will Touch

| File | Current State | Required Change |
|------|--------------|-----------------|
| src/routes/search/+page.svelte | Заглушка | Полноценная страница поиска |
| src/routes/+page.svelte | Input без обработчика, chips как button | Добавить Enter -> goto, chips -> ссылки на /search?category= |
| src/lib/data/catalog.js | loadCatalog(), getCatalogDate() | Без изменений — используем as is |
| package.json | Нет minisearch | Добавить dependency: minisearch |

### Новые файлы

| File | Purpose |
|------|---------|
| src/lib/search/engine.js | MiniSearch: инициализация, индексирование, поиск, синонимы |
| src/lib/search/synonyms.js | Словарь синонимов электротехники |
| src/lib/search/normalize.js | Нормализация артикулов |
| src/lib/stores/cart.svelte.js | Список покупок (runes-based module state) |
| src/lib/components/ProductCard.svelte | Компактная карточка товара в списке |
| src/lib/components/ProductSheet.svelte | Bottom sheet с полным описанием |
| src/lib/components/CartPanel.svelte | Экран "Показать менеджеру" |
| src/lib/utils/clipboard.js | Копирование в буфер с fallback |

### Potential Conflicts

- `src/routes/+page.svelte` — изменение chips и input. Никто другой не импортирует, конфликтов нет.
- `package.json` — добавление minisearch. Безопасно, нет конфликтов.
- Чипсы на главной сейчас `["Автоматы", "Кабель", "Розетки", "Щиты", "Освещение", "УЗО", "Инструмент"]` — но категории в каталоге называются иначе (`"Автоматические выключатели"`, не `"Автоматы"`). Нужен маппинг chip -> category или поиск по тексту чипа.
## Recommended Approach

### Decision: Поисковый движок

**Chosen approach:** MiniSearch v7 с processTerm для синонимов при индексации
**Reason:** Библиотека без зависимостей, 7KB gzip, идеально для 74-1000 товаров в PWA. processTerm при индексации проще чем query expansion — синонимы работают автоматически без доп. логики при каждом поиске.

#### Option A: MiniSearch + processTerm синонимы при индексации (RECOMMENDED)
- **Pros:** Синонимы работают автоматически при любом поиске; не нужна доп. библиотека minisearch-synonyms; processTerm может возвращать массив терминов
- **Cons:** При изменении словаря синонимов нужно переиндексировать (но каталог грузится один раз при старте — это не проблема)

#### Option B: MiniSearch + minisearch-synonyms (query expansion)
- **Pros:** Отделяет синонимы от индекса, можно менять на лету
- **Cons:** Лишняя dependency; каждый search() требует expandQuery(); для 74 товаров и перезагрузки при старте — overkill
- **Why rejected:** Добавляет сложность без реального выигрыша для нашего масштаба

### Decision: Bottom sheet

**Chosen approach:** DaisyUI `modal modal-bottom` (HTML dialog)
**Reason:** DaisyUI 5 поддерживает modal-bottom из коробки. Это нативный `<dialog>`, доступный, закрывается по Esc и клику backdrop. Не нужен кастомный CSS или JS для анимации.

#### Option A: DaisyUI modal-bottom (RECOMMENDED)
- **Pros:** Нативный HTML dialog; анимация slide-up встроена; доступность (Esc, backdrop); уже в стеке
- **Cons:** Нет drag-to-dismiss (не критично для MVP)

#### Option B: Кастомный bottom sheet на CSS + JS
- **Pros:** Полный контроль, drag-to-dismiss
- **Cons:** Много кода, нужно самому обрабатывать Esc/backdrop/focus trap, потенциальные баги на iOS
- **Why rejected:** Лишняя работа при наличии DaisyUI modal-bottom

### Decision: Список покупок (state)

**Chosen approach:** Svelte 5 runes module-level $state в .svelte.js файле
**Reason:** Svelte 5 runes позволяют создавать реактивный state вне компонентов в файлах .svelte.js. Проще чем stores, нативный подход Svelte 5.
## Technology Notes

### MiniSearch v7.2.0

**Установка:**
```bash
npm install minisearch
```

**Конструктор и индексация:**
```javascript
import MiniSearch from "minisearch";

const miniSearch = new MiniSearch({
  idField: "id",
  fields: ["article", "name", "description", "category", "brand"],
  storeFields: ["id", "article", "name", "category", "brand", "inStock", "unit"],
  tokenize: (text, fieldName) => {
    // Дефолтный токенизатор MiniSearch разбивает по НЕ-алфавитным символам.
    // Кириллица считается алфавитной — работает из коробки.
    // Но нам нужно также разбивать по дефисам в артикулах.
    return text.toLowerCase().split(/[s-_.,;:!?()]+/).filter(t => t.length > 0);
  },
  processTerm: (term, fieldName) => {
    const lower = term.toLowerCase();
    // Применить синонимы: возвращаем массив [оригинал, ...синонимы]
    const syns = getSynonyms(lower);
    return syns ? [lower, ...syns] : lower;
  }
});

// Индексация
miniSearch.addAll(catalog.items);
```

**Поиск:**
```javascript
const results = miniSearch.search(query, {
  boost: { article: 3, name: 2, brand: 1.5, category: 1, description: 0.5 },
  fuzzy: 0.2,         // до 20% символов могут отличаться
  prefix: true,        // "ВА47" найдёт "ВА47-29..."
  combineWith: "OR"    // любое поле может совпасть
});
```

**Возвращаемый формат search():**
```javascript
[
  { id: 3, article: "BA47-29-1P-16A", name: "...", score: 12.5, match: {}, terms: [] },
  // ...storeFields + score + match + terms
]
```

**autoSuggest():**
```javascript
const suggestions = miniSearch.autoSuggest(query, { fuzzy: 0.2 });
// [{ suggestion: "автомат", terms: ["автомат"], score: 5.2 }, ...]
```

**Version-specific gotchas:**
- MiniSearch v7 требует ES2018+. SvelteKit + Vite транспилируют — проблем нет.
- Дефолтный токенизатор разбивает по Unicode "non-word" boundaries. Кириллица входит в Unicode word characters — работает корректно. Но дефис `-` в артикулах тоже считается разделителем — что нам и нужно.
- `storeFields` НЕ индексируются для поиска. `fields` НЕ хранятся в результатах, если не указаны в storeFields. Нужно указывать поля в обоих массивах если нужно и искать, и возвращать.
- fuzzy: 0.2 означает "до 20% длины термина" edit distance. Для коротких слов (3 буквы) — 0 edits. Для слов 5+ букв — 1 edit. Для 10+ — 2 edits.
- prefix: true работает только для последнего термина в multi-word query по умолчанию.
### Нормализация артикулов

**Проблема:** Пользователь вводит "ВА47-29 1P 16А" (кириллица, пробелы), а в каталоге "BA47-29-1P-16A" (латиница, дефисы).

**Решение:** Нормализовать И запрос пользователя, И артикулы при индексации через одну функцию:

```javascript
// src/lib/search/normalize.js

const cyrToLat = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
  "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
  "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
  "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya"
};

/**
 * Нормализация артикулов для поиска.
 * "ВА47-29 1P 16А" -> "va47291p16a"
 * "BA47-29-1P-16A" -> "ba47291p16a"
 */
export function normalizeArticle(str) {
  return str
    .toLowerCase()
    .split("")
    .map(ch => cyrToLat[ch] ?? ch)
    .join("")
    .replace(/[s-_./]+/g, "")  // убрать разделители
    .replace(/[^a-z0-9]/g, "");  // оставить только латиницу и цифры
}
```

**Важно:** Транслитерация нужна ТОЛЬКО для поля article. Для name/description/category — поиск по кириллице as is. Поэтому normalizeArticle вызывается отдельно, не через processTerm.

**Стратегия:** Добавить нормализованный артикул как отдельное поле `articleNorm` при индексации. Так exact match по артикулу работает всегда, а fuzzy search по name/description — отдельно.

```javascript
// При подготовке данных для индекса:
const indexItems = catalog.items.map(item => ({
  ...item,
  articleNorm: normalizeArticle(item.article)
}));

// В MiniSearch:
// fields: ["articleNorm", "name", "description", "category", "brand"],
// boost: { articleNorm: 5, name: 2, brand: 1.5, category: 1, description: 0.5 }
```

При поиске — нормализовать запрос, если он похож на артикул:

```javascript
function isArticleLike(query) {
  // Содержит цифры — скорее всего артикул или часть артикула
  return /d/.test(query);
}

function searchCatalog(query) {
  const results = miniSearch.search(query, {
    boost: { articleNorm: 5, article: 3, name: 2, brand: 1.5, category: 1, description: 0.5 },
    fuzzy: 0.2,
    prefix: true
  });

  // Дополнительно: если запрос похож на артикул, искать нормализованным
  if (isArticleLike(query)) {
    const normQuery = normalizeArticle(query);
    const normResults = miniSearch.search(normQuery, {
      fields: ["articleNorm"],
      fuzzy: 0.3,
      prefix: true
    });
    // Merge results, deduplicate by id, keep highest score
    return mergeResults(results, normResults);
  }

  return results;
}
```
### Словарь синонимов электротехники

```javascript
// src/lib/search/synonyms.js

/**
 * Словарь синонимов для электротехники ЭлектроЦентр.
 * Формат: массив групп. Все слова в группе — синонимы друг друга.
 * При индексации: каждое слово индексируется вместе со всеми синонимами группы.
 */
export const synonymGroups = [
  // Устройства защиты
  ["дифавтомат", "авдт", "дифференциальный автомат", "диф"],
  ["узо", "устройство защитного отключения", "выключатель дифференциальный", "вд"],
  ["автомат", "автоматический выключатель", "ав", "выключатель автоматический"],
  ["рубильник", "выключатель нагрузки", "разъединитель"],

  // Бренды (кириллица - латиница)
  ["iek", "иек", "иэк"],
  ["abb", "абб"],
  ["ekf", "экф"],
  ["tdm", "тдм"],
  ["legrand", "легранд"],

  // Кабельная продукция
  ["кабель", "провод", "шнур"],
  ["ввг", "ввгнг", "ввгнг-ls", "ввгнга"],
  ["пвс", "провод соединительный"],
  ["гофра", "гофрированная труба", "гофротруба", "труба гофрированная"],
  ["металлорукав", "металлическая гофра", "рукав металлический"],
  ["кабель-канал", "кабельный канал", "короб", "пластиковый короб"],

  // Электроустановочные изделия
  ["розетка", "розетка электрическая", "штепсельная розетка"],
  ["выключатель", "клавишный выключатель", "переключатель"],
  ["проходной", "проходной выключатель", "переключатель проходной"],

  // Щиты
  ["щит", "щиток", "бокс", "щит распределительный", "электрощит"],
  ["навесной", "наружный", "накладной", "щрн"],
  ["встраиваемый", "внутренний", "щрв", "утопленный"],

  // Освещение
  ["лампа", "лампочка", "светодиодная лампа", "led лампа"],
  ["светильник", "люстра", "плафон"],
  ["панель", "светодиодная панель", "led панель", "армстронг"],
  ["прожектор", "промышленный светильник", "фонарь"],

  // Единицы / характеристики
  ["ампер", "а", "amp"],
  ["ватт", "вт", "w"],
];

/**
 * Построить lookup: term -> [synonyms]
 */
export function buildSynonymMap(groups) {
  const map = new Map();
  for (const group of groups) {
    for (const term of group) {
      const others = group.filter(t => t !== term);
      const existing = map.get(term) || [];
      map.set(term, [...new Set([...existing, ...others])]);
    }
  }
  return map;
}
```

**Подключение к MiniSearch через processTerm:**

```javascript
import { synonymGroups, buildSynonymMap } from "./synonyms.js";

const synonymMap = buildSynonymMap(synonymGroups);

function getSynonyms(term) {
  return synonymMap.get(term) || null;
}

// В конструкторе MiniSearch:
// processTerm: (term) => {
//   const lower = term.toLowerCase();
//   const syns = getSynonyms(lower);
//   return syns ? [lower, ...syns] : lower;
// }
```

**Важно:** processTerm при ИНДЕКСАЦИИ возвращает массив — MiniSearch индексирует документ под всеми этими терминами. При ПОИСКЕ processTerm вызывается для query terms — тоже можно вернуть массив, и MiniSearch будет искать по всем. Двусторонняя работа синонимов.
### DaisyUI modal-bottom для Bottom Sheet

```svelte
<!-- ProductSheet.svelte -->
<script>
  let { product = null, onclose } = $props();
  let dialog;

  $effect(() => {
    if (product) {
      dialog?.showModal();
    } else {
      dialog?.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  class="modal modal-bottom"
  onclose={onclose}
>
  <div class="modal-box rounded-t-2xl max-h-[80vh]">
    {#if product}
      <h3 class="font-bold text-lg">{product.name}</h3>
      <p class="text-sm text-base-content/60">{product.article}</p>
      <!-- ... specs, кнопка "В список" ... -->
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

**Ключевые моменты:**
- `modal-bottom` — прижимает к низу экрана
- `rounded-t-2xl` — скруглённые верхние углы (паттерн bottom sheet)
- `max-h-[80vh]` — ограничить высоту, чтобы не закрывал весь экран
- `<form method="dialog" class="modal-backdrop">` — клик по backdrop закрывает
- `dialog.showModal()` / `dialog.close()` — нативные методы HTML dialog
- Анимация появления встроена в DaisyUI modal
### Clipboard API

```javascript
// src/lib/utils/clipboard.js

/**
 * Копирование текста в буфер обмена.
 * navigator.clipboard.writeText требует:
 * 1. HTTPS или localhost
 * 2. Вызов из user gesture (click handler)
 * 3. На iOS Safari — СИНХРОННЫЙ вызов из click (не после await)
 *
 * Fallback через textarea + execCommand для старых браузеров.
 */
export async function copyToClipboard(text) {
  // Пробуем современный API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API failed, trying fallback:", err);
    }
  }

  // Fallback для iOS Safari и старых браузеров
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error("Fallback copy failed:", err);
    return false;
  }
}
```

**iOS Safari gotcha:** Safari блокирует clipboard.writeText если вызов произошёл после асинхронной операции (fetch, setTimeout). Решение: вызывать copyToClipboard ПРЯМО из onclick handler, не после await. В Svelte:

```svelte
<button onclick={() => copyToClipboard(formattedText)}>
  Скопировать список
</button>
```

НЕ делать:
```svelte
<!-- ПЛОХО: async перед clipboard = Safari заблокирует -->
<button onclick={async () => {
  const text = await formatList();
  await copyToClipboard(text);
}}>
```
### SvelteKit Query Params (Svelte 5)

**Чтение параметров в +page.svelte:**

```svelte
<script>
  import { page } from "$app/state";  // Svelte 5 / SvelteKit 2+

  // Реактивный доступ к query params
  let query = $derived(page.url.searchParams.get("q") || "");
  let category = $derived(page.url.searchParams.get("category") || "");
</script>
```

**Fallback (если $app/state не доступен в текущей версии SvelteKit):**

```svelte
<script>
  import { page } from "$app/stores";

  let query = $derived($page.url.searchParams.get("q") || "");
</script>
```

**Навигация с параметрами (со стартовой страницы):**

```svelte
<script>
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";

  let inputValue = $state("");

  function handleSearch(e) {
    e.preventDefault();
    if (inputValue.trim()) {
      goto(`${base}/search/?q=${encodeURIComponent(inputValue.trim())}`);
    }
  }
</script>

<form onsubmit={handleSearch}>
  <input bind:value={inputValue} type="text" />
</form>
```

**Chips на главной:**
```svelte
{#each chips as chip}
  <a href="{base}/search/?category={encodeURIComponent(chip.category)}"
     class="badge badge-outline badge-lg ...">
    {chip.label}
  </a>
{/each}
```

**Trailing slash:** В проекте `trailingSlash: "always"` — URL должны заканчиваться на `/`. Поэтому `/search/?q=...`, НЕ `/search?q=...`.
## Integration Points

### Inputs (from Phase 1)
- `src/lib/data/catalog.js` — `loadCatalog()` возвращает `{ lastUpdated, items: [...] }`
- `static/catalog.json` — 74 товара, формат item: `{ id, article, name, category, subcategory, brand, description, specs, inStock, unit }`
- `src/routes/+page.svelte` — стартовая страница, input и chips нужно модифицировать
- `$app/paths` -> `base` — все ссылки через base (= "/zalassist" в production)
- `trailingSlash: "always"` — URL заканчиваются на /

### Outputs (for Phase 3)
- `src/lib/search/engine.js` — Phase 3 использует для кнопки "Спросить ИИ" (из zero-result), и для поиска товаров в ответе ИИ
  - Must export: `createSearchEngine(items)`, возвращает `{ search, suggest, getFallback }`
- `src/lib/stores/cart.svelte.js` — Phase 3 может добавлять товары из ИИ-ответа в список
  - Must export: `cart` с методами `.add(product)`, `.remove(id)`, `.clear()`, `.formatText()`
- `src/lib/components/ProductCard.svelte` — Phase 3 переиспользует для отображения товаров в ответе ИИ
  - Must accept props: `product`, `onAddToCart`
## Pitfalls to Avoid

1. **Чипсы не совпадают с категориями** — На главной чипсы: "Автоматы", "Кабель", "Розетки", "Щиты", "Освещение", "УЗО", "Инструмент". Категории в каталоге: "Автоматические выключатели", "Кабель и провод", etc. Решение: chips должны вести на `/search/?q=Автоматы` (текстовый поиск), НЕ на `?category=Автоматы` (exact match). Либо создать маппинг chip -> полная категория.

2. **trailingSlash: "always"** — Все внутренние ссылки должны заканчиваться на `/`. `goto(base + "/search/?q=...")`. Если забыть `/` — SvelteKit сделает redirect 308, что создаст лишний запрос.

3. **iOS Safari Clipboard** — Не вызывать clipboard.writeText после async операций. Формировать текст синхронно, копировать сразу в onclick.

4. **processTerm и fuzzy конфликт** — Если processTerm возвращает массив синонимов, fuzzy search применяется к КАЖДОМУ синониму. Это нормально и даже полезно, но может увеличить количество результатов. Ограничить результаты top-N (10-15).

5. **normalizeArticle не должен применяться к name/description** — Транслитерация кириллица -> латиница для article only. Если применить к name — поиск "автомат" превратится в "avtomat" и ничего не найдёт.

6. **Svelte 5 runes в .svelte.js** — Файлы с module-level $state ДОЛЖНЫ иметь расширение `.svelte.js` (не `.js`). Svelte compiler обрабатывает runes только в `.svelte` и `.svelte.js` файлах.

7. **Empty search state** — При переходе на /search/ без параметров — показать категории или популярные товары, не пустой экран. SEARCH-04 требует: никогда пустой экран.

8. **MiniSearch score = 0 при exact match stopword** — MiniSearch может игнорировать очень короткие термины. При fuzzy: 0.2, слова из 1-2 букв не получат fuzzy edits. Убедиться что "УЗО" (3 буквы) ищется корректно — протестировать.

9. **Кириллическая А vs латинская A в артикулах** — В каталоге article "BA47-29-1P-16A" — латиница. Пользователь набирает "ВА47-29 1Р 16А" — кириллица. normalizeArticle решает это через транслитерацию, но важно не забыть нормализовать ОБЕ стороны.

10. **DaisyUI modal и scroll lock** — `<dialog>.showModal()` блокирует скролл body. Это корректное поведение для bottom sheet, но после close() нужно убедиться что скролл восстановился. Нативный dialog делает это автоматически.
## Code Examples

### Полный поисковый модуль (src/lib/search/engine.js)

```javascript
import MiniSearch from "minisearch";
import { synonymGroups, buildSynonymMap } from "./synonyms.js";
import { normalizeArticle } from "./normalize.js";

const synonymMap = buildSynonymMap(synonymGroups);

function getSynonyms(term) {
  return synonymMap.get(term) || null;
}

/**
 * Создать поисковый движок из массива товаров.
 * @param {Array} items - catalog.items
 * @returns {object} - { search, suggest, getFallback }
 */
export function createSearchEngine(items) {
  const enriched = items.map(item => ({
    ...item,
    articleNorm: normalizeArticle(item.article)
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

  function search(query, limit = 15) {
    if (!query || !query.trim()) return [];

    const trimmed = query.trim();
    let results = miniSearch.search(trimmed, {
      boost: { articleNorm: 5, article: 3, name: 2, brand: 1.5, category: 1, description: 0.5 },
      fuzzy: 0.2,
      prefix: true,
      combineWith: "OR"
    });

    // Дополнительный поиск по нормализованному артикулу
    if (/\d/.test(trimmed)) {
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

  function suggest(query) {
    if (!query || query.trim().length < 2) return [];
    return miniSearch.autoSuggest(query.trim(), {
      fuzzy: 0.2,
      prefix: true
    }).slice(0, 5);
  }

  function getFallback(query, allItems) {
    const words = query.trim().split(/\s+/);
    for (const word of words) {
      if (word.length < 2) continue;
      const partial = miniSearch.search(word, { fuzzy: 0.3, prefix: true });
      if (partial.length > 0) return partial.slice(0, 5);
    }
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }

  return { search, suggest, getFallback };
}

function mergeResults(a, b) {
  const seen = new Map();
  for (const r of a) seen.set(r.id, r);
  for (const r of b) {
    if (seen.has(r.id)) {
      const existing = seen.get(r.id);
      if (r.score > existing.score) seen.set(r.id, r);
    } else {
      seen.set(r.id, r);
    }
  }
  return [...seen.values()].sort((x, y) => y.score - x.score);
}
```
### Список покупок (src/lib/stores/cart.svelte.js)

```javascript
// Файл ОБЯЗАТЕЛЬНО .svelte.js для работы runes вне компонентов

let items = $state([]);

export const cart = {
  get items() { return items; },
  get count() { return items.length; },

  add(product, qty = 1) {
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ ...product, qty });
    }
  },

  remove(id) {
    items = items.filter(i => i.id !== id);
  },

  clear() {
    items = [];
  },

  formatText() {
    if (items.length === 0) return "";
    const lines = items.map(i =>
      `${i.article} — ${i.name}${i.qty > 1 ? " (" + i.qty + " " + i.unit + ")" : ""}`
    );
    return lines.join("
");
  }
};
```

## Open Questions for Planner

1. **Маппинг чипсов -> категории:** Рекомендация — создать массив `{ label: "Автоматы", category: "Автоматические выключатели" }` и использовать `?category=` с exact match по полю category. Чип "Инструмент" отсутствует в каталоге — убрать или заменить на "Кабельные каналы".

2. **autoSuggest на лету или только по Enter?** Рекомендация для MVP — поиск только по Enter/кнопке. autoSuggest (debounced) добавить позже если нужно. Это проще и не перегружает UI.

3. **Количество товаров в списке:** По умолчанию qty = 1. Нужен ли +/- счётчик? Рекомендация для MVP — да, минимальный stepper в CartPanel, так как B2B-клиенты покупают оптом.

4. **Навигация к "Показать менеджеру":** Отдельная страница `/list/` или модалка? Рекомендация — модалка (modal fullscreen), чтобы клиент не терял контекст поиска. Но если нужен shareable URL — отдельная страница.