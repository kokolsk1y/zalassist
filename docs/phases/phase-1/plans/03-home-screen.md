---
phase: 1
plan: home-screen
wave: 2
requires:
  - project-init
  - mock-catalog
req_ids:
  - UI-01
  - UI-02
  - UI-03
  - UI-04
status: pending
---

# Plan: Стартовый экран и загрузка каталога

## Objective
Реализовать стартовый экран в стиле Perplexity с тремя CTA-кнопками, suggestion chips, загрузкой каталога и отображением даты обновления. Создать страницы-заглушки для /search, /chat, /kits.

## Context
- Зависит от plan `project-init` (SvelteKit настроен, тема работает) и `mock-catalog` (catalog.json существует)
- Дизайн описан в CONTEXT.md: Perplexity-стиль, 3 CTA, поле ввода, suggestion chips
- Палитра: primary #2b7de0, accent/CTA #f15a2c (оранжевый — только на Send и "В список"), surface #f5f7fa
- Tap target: минимум 48x48px (в DaisyUI btn-lg = 48px+, подходит)
- ВСЕ ссылки через `import { base } from "$app/paths"` — иначе сломается на GitHub Pages
- Svelte 5 runes syntax: $state, $derived, $effect, $props
- Lucide-svelte для иконок: Search, MessageSquare, Package
- Каталог загружается через fetch, дата берётся из catalog.json.lastUpdated
- Прочитать: `c:/Users/ikoko/Projects/ZalAssist/docs/phases/phase-1/RESEARCH.md` — секция "Code Examples"

## Tasks

### Task 1: Создать модуль загрузки каталога
**What:** Сервис для загрузки catalog.json через fetch с кэшированием в памяти.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/data/catalog.js`
**How:**
```javascript
import { base } from "$app/paths";

let catalogCache = null;

export async function loadCatalog() {
  if (catalogCache) return catalogCache;

  const response = await fetch(base + "/catalog.json");
  if (!response.ok) throw new Error("Failed to load catalog");

  catalogCache = await response.json();
  console.log("Catalog loaded: " + catalogCache.items.length + " items");
  return catalogCache;
}

export function getCatalogDate() {
  return catalogCache?.lastUpdated ?? "неизвестно";
}
```
Экспортирует две функции: `loadCatalog()` и `getCatalogDate()`.
Phase 2 будет импортировать этот модуль для MiniSearch индексации.
**Done when:** `grep "loadCatalog" src/lib/data/catalog.js` находит экспорт. `grep "getCatalogDate" src/lib/data/catalog.js` находит экспорт.

### Task 2: Создать стартовый экран
**What:** Главная страница с 3 CTA, полем ввода, suggestion chips и датой каталога.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/+page.svelte`
**How:**
Структура компонента:
1. **Лого/название** — `<h1>ЭлектроЦентр</h1>` + подпись "Помощник в торговом зале"
2. **Hero-текст** — "Что будем делать?" (text-3xl font-bold)
3. **Поле ввода** — `<input>` с placeholder "Артикул, название или задача..." (input input-bordered input-lg). Пока без логики — в Phase 2 подключим к поиску.
4. **3 CTA-кнопки** (в порядке: "Найти товар" primary, "Подобрать под задачу" outline, "Готовые комплекты" outline):
   - Ссылки через `{base}/search`, `{base}/chat`, `{base}/kits`
   - Иконки: Search, MessageSquare, Package из lucide-svelte
   - Минимальная высота 52px (min-h-[52px])
   - Кнопка "Найти товар" — `btn btn-primary`
   - Остальные — `btn btn-outline`
5. **Suggestion chips** — badge-кнопки: "Автоматы", "Кабель", "Розетки", "Щиты", "Освещение", "УЗО", "Инструмент". Пока без логики клика.
6. **Дата обновления каталога** — внизу экрана, мелким шрифтом (text-xs text-base-content/40). Загружается из catalog.js при onMount.

Svelte 5 runes:
```svelte
<script>
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { loadCatalog, getCatalogDate } from "$lib/data/catalog.js";
  import { Search, MessageSquare, Package } from "lucide-svelte";

  let catalogDate = $state("...");

  onMount(async () => {
    try {
      await loadCatalog();
      catalogDate = getCatalogDate();
    } catch (e) {
      catalogDate = "ошибка загрузки";
      console.error("Catalog load failed:", e);
    }
  });
</script>
```

Весь экран — `min-h-screen bg-base-200 flex flex-col items-center px-4 pt-12 pb-8`.
Максимальная ширина контента — `max-w-md`.

ВАЖНО: Все href используют `{base}/path`, не `/path`.
**Done when:** `grep "base" src/routes/+page.svelte` находит импорт из `$app/paths`. `grep "loadCatalog" src/routes/+page.svelte` находит вызов. В файле присутствуют все три ссылки: `/search`, `/chat`, `/kits`.

### Task 3: Создать страницы-заглушки
**What:** Минимальные +page.svelte для роутов /search, /chat, /kits — чтобы CTA-кнопки не вели на 404.
**Where:**
- `c:/Users/ikoko/Projects/ZalAssist/src/routes/search/+page.svelte`
- `c:/Users/ikoko/Projects/ZalAssist/src/routes/chat/+page.svelte`
- `c:/Users/ikoko/Projects/ZalAssist/src/routes/kits/+page.svelte`

**How:**
Каждая страница — одинаковая структура:
```svelte
<script>
  import { base } from "$app/paths";
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center px-4">
  <h1 class="text-2xl font-bold text-base-content mb-4">[Название раздела]</h1>
  <p class="text-base-content/60 mb-8">Этот раздел появится в следующем обновлении</p>
  <a href="{base}/" class="btn btn-primary">На главную</a>
</div>
```

Названия разделов:
- search: "Поиск товаров"
- chat: "Подбор под задачу"
- kits: "Готовые комплекты"

**Done when:** Файлы `src/routes/search/+page.svelte`, `src/routes/chat/+page.svelte`, `src/routes/kits/+page.svelte` существуют. Каждый содержит ссылку `{base}/` на главную.

### Task 4: Проверить сборку и навигацию
**What:** Убедиться что `npm run build` проходит, все страницы рендерятся, каталог загружается.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/`
**How:**
```bash
npm run build
```
Проверить:
- `build/index.html` существует
- `build/search/index.html` существует
- `build/chat/index.html` существует
- `build/kits/index.html` существует
- `build/catalog.json` существует
- В build/index.html есть текст "ЭлектроЦентр"
**Done when:** `npm run build` завершается с exit code 0. Все 4 HTML-файла и catalog.json присутствуют в build/.

## Tests Required
- `npm run build` без ошибок
- Все 4 роута генерируют HTML (index, search, chat, kits)
- catalog.json копируется в build/
- Dev-сервер: стартовый экран отображает 3 кнопки и дату каталога

## Definition of Done
- [ ] Модуль `src/lib/data/catalog.js` экспортирует loadCatalog() и getCatalogDate()
- [ ] Стартовый экран содержит: лого, hero-текст, поле ввода, 3 CTA, suggestion chips, дату каталога
- [ ] Все ссылки используют `{base}` из `$app/paths`
- [ ] Tap target кнопок >= 48px (btn-lg)
- [ ] Страницы-заглушки /search, /chat, /kits существуют и содержат ссылку на главную
- [ ] Каталог загружается при открытии стартового экрана, количество записей логируется в консоль
- [ ] Дата обновления каталога отображается в UI (UI-04)
- [ ] `npm run build` завершается без ошибок
