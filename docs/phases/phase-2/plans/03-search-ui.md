---
phase: 2
plan: search-ui
wave: 2
requires: [search-engine, cart-and-clipboard]
req_ids: [SEARCH-02, SEARCH-04, UI-05]
status: pending
---

# Plan: UI страницы поиска и компоненты товаров

## Objective

Заменить заглушку `/search/` на полноценную страницу поиска с результатами, карточками товаров, bottom sheet деталей, кнопкой "В список", дисклеймером и zero-result fallback.

## Context

- Заглушка: `src/routes/search/+page.svelte` — полностью заменить
- Зависимости (Wave 1): `src/lib/search/engine.js` (createSearchEngine), `src/lib/stores/cart.svelte.js` (cart)
- Загрузка каталога: `import { loadCatalog } from "$lib/data/catalog.js"`
- Query params: `import { page } from "$app/state"` или `$app/stores`, trailing slash обязательна
- DaisyUI modal-bottom для bottom sheet: `<dialog class="modal modal-bottom">`
- Все ссылки через `import { base } from "$app/paths"`
- Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`
- Lucide-svelte для иконок
- SEARCH-04: никогда пустой экран — при 0 результатах показать fallback + кнопку "Спросить ИИ"
- UI-05: дисклеймер "Наличие и цены уточняйте у консультанта" под результатами

## Tasks

### Task 1: Создать компонент ProductCard

**What:** Компактная карточка товара для списка результатов. Показывает: артикул (мелким), название, бренд (badge), наличие (зеленый/серый badge). Кнопка "+" добавляет в cart. При клике на карточку — вызывает callback onSelect.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/components/ProductCard.svelte`
**How:**
Props (через `$props()`):
- `product` — объект товара из результатов поиска
- `onselect` — callback при клике на карточку (открыть sheet)
- `onadd` — callback при клике "+" (добавить в cart)

Разметка:
```svelte
<div class="card bg-base-100 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
     onclick={() => onselect?.(product)}
     role="button" tabindex="0">
  <div class="card-body p-4 gap-1">
    <p class="text-xs text-base-content/50 font-mono">{product.article}</p>
    <h3 class="card-title text-sm leading-tight">{product.name}</h3>
    <div class="flex items-center gap-2 mt-1">
      <span class="badge badge-sm badge-ghost">{product.brand}</span>
      {#if product.inStock}
        <span class="badge badge-sm badge-success gap-1">В наличии</span>
      {:else}
        <span class="badge badge-sm badge-ghost">Под заказ</span>
      {/if}
    </div>
    <div class="card-actions justify-end mt-2">
      <button class="btn btn-primary btn-sm btn-circle"
              onclick|stopPropagation={() => onadd?.(product)}
              aria-label="Добавить в список">
        +
      </button>
    </div>
  </div>
</div>
```

Важно: `onclick|stopPropagation` на кнопке "+" чтобы не открывался sheet.

**Done when:** Файл `src/lib/components/ProductCard.svelte` существует и содержит `$props()`

### Task 2: Создать компонент ProductSheet (bottom sheet)

**What:** DaisyUI modal-bottom с полной информацией о товаре: артикул, название, бренд, категория, описание, specs (таблица), наличие, кнопка "В список".
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/components/ProductSheet.svelte`
**How:**
Props:
- `product` — объект товара (или null)
- `onclose` — callback при закрытии
- `onadd` — callback при "В список"

Использовать `<dialog class="modal modal-bottom">`:
- `$effect`: если product не null — `dialog.showModal()`, иначе `dialog.close()`
- Внутри `modal-box rounded-t-2xl max-h-[80vh]`:
  - Артикул крупным моноширинным шрифтом
  - Название (h3)
  - Бренд + категория badges
  - Описание (p)
  - Specs: таблица key-value из `product.specs` (Object.entries)
  - Наличие badge
  - Кнопка "В список" (btn btn-primary btn-block)
- `<form method="dialog" class="modal-backdrop"><button>close</button></form>`

**Done when:** `grep "modal modal-bottom" c:/Users/ikoko/Projects/ZalAssist/src/lib/components/ProductSheet.svelte` находит паттерн

### Task 3: Реализовать страницу поиска

**What:** Полноценная страница `/search/` с полем ввода, результатами, zero-result fallback, дисклеймером.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/search/+page.svelte`
**How:**

Читать перед началом:
- `c:/Users/ikoko/Projects/ZalAssist/src/lib/search/engine.js`
- `c:/Users/ikoko/Projects/ZalAssist/src/lib/data/catalog.js`
- `c:/Users/ikoko/Projects/ZalAssist/src/lib/stores/cart.svelte.js`

Логика:
1. `onMount`: загрузить каталог через `loadCatalog()`, создать движок через `createSearchEngine(catalog.items)`
2. Читать query params: `page.url.searchParams.get("q")` и `page.url.searchParams.get("category")`
3. `$effect`: при изменении query или category — выполнить поиск. Если есть `category` — отфильтровать items по `item.category === categoryMap[category]` и показать. Если есть `q` — вызвать `engine.search(q)`.
4. Маппинг чипсов->категорий: `{ "Автоматы": "Автоматические выключатели", "Кабель": "Кабель и провод", "Розетки": "Розетки и выключатели", "Щиты": "Щиты и боксы", "Освещение": "Освещение", "УЗО": "УЗО и дифавтоматы" }` — уточнить по реальным категориям из catalog.json.
5. Zero-result (SEARCH-04): если `results.length === 0` и есть query, вызвать `engine.getFallback(query, catalog.items)`. Показать текст "По запросу '{query}' ничего не найдено" + fallback товары под заголовком "Возможно, вы искали:" + кнопка "Спросить ИИ" (`<a href="{base}/chat/">`) — disabled с текстом "Скоро" пока Phase 3 не готова.
6. Пустое состояние (нет query и нет category): показать чипсы категорий для быстрого выбора.

Разметка:
- Поле ввода наверху (`input input-bordered`) с `bind:value` и обработчиком Enter (обновить URL через `goto`)
- Кнопка "Назад" (`<a href="{base}/">`)
- Счетчик результатов
- Список `ProductCard` компонентов
- Дисклеймер (UI-05): `<p class="text-xs text-base-content/50 text-center mt-4">Наличие и цены уточняйте у консультанта</p>` — показывать когда есть результаты
- `ProductSheet` — один на страницу, управляется через `selectedProduct` state
- Значок корзины со счетчиком `cart.count` — ведет на CartPanel

Значок корзины в правом верхнем углу (fixed или в header):
```svelte
{#if cart.count > 0}
  <button class="btn btn-circle btn-primary btn-sm fixed top-4 right-4 z-50"
          onclick={() => showCart = true}>
    {cart.count}
  </button>
{/if}
```

**Done when:** Файл `src/routes/search/+page.svelte` содержит `createSearchEngine` и `ProductCard`

### Task 4: Определить маппинг чипсов к категориям

**What:** Внутри search/+page.svelte создать константу `categoryMap` с маппингом label чипа на точное название категории из catalog.json.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/search/+page.svelte` (внутри Task 3)
**How:**
Прочитать все уникальные значения `category` из `static/catalog.json` и сопоставить с чипами на главной:
- "Автоматы" -> "Автоматические выключатели"
- "Кабель" -> "Кабель и провод"
- "Розетки" -> "Розетки и выключатели"
- "Щиты" -> "Щиты и боксы"
- "Освещение" -> "Освещение"
- "УЗО" -> "УЗО и дифавтоматы"
- "Инструмент" -> убрать если категории нет в каталоге, или заменить

Исполнитель ОБЯЗАН сначала прочитать catalog.json и извлечь уникальные категории: `[...new Set(catalog.items.map(i => i.category))]`

**Done when:** Маппинг соответствует реальным категориям в catalog.json

## Tests Required

- Переход на `/search/?q=автомат` показывает результаты (не заглушку)
- Переход на `/search/?category=Автоматы` показывает товары из категории "Автоматические выключатели"
- Поиск несуществующего товара показывает fallback и кнопку "Спросить ИИ"
- Клик на карточку открывает bottom sheet с деталями
- Кнопка "+" добавляет товар в cart, счетчик появляется
- Дисклеймер виден под результатами

## Definition of Done

- [ ] `src/lib/components/ProductCard.svelte` существует, принимает props product/onselect/onadd
- [ ] `src/lib/components/ProductSheet.svelte` существует, использует modal-bottom
- [ ] `src/routes/search/+page.svelte` — полноценная страница (не заглушка)
- [ ] Поиск по тексту возвращает результаты через MiniSearch
- [ ] Фильтр по категории работает через query param `?category=`
- [ ] Zero-result показывает fallback товары и кнопку "Спросить ИИ"
- [ ] Дисклеймер "Наличие и цены уточняйте у консультанта" виден под результатами
- [ ] `npm run build` завершается без ошибок
