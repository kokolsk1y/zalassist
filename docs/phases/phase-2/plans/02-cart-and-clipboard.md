---
phase: 2
plan: cart-and-clipboard
wave: 1
requires: []
req_ids: [UI-06]
status: pending
---

# Plan: Список покупок (cart) и утилита копирования

## Objective

Создать реактивный модуль списка покупок на Svelte 5 runes и утилиту копирования в буфер обмена с fallback для iOS Safari. Модуль cart экспортирует API для добавления/удаления товаров и форматирования текста для менеджера.

## Context

- Svelte 5 runes: module-level `$state` в файлах `.svelte.js` (не `.js`)
- iOS Safari: `clipboard.writeText` блокируется после async операций — вызывать синхронно из onclick
- Cart используется в Phase 2 (ProductCard, CartPanel) и в Phase 3 (добавление товаров из ИИ-ответа)
- API cart: `.add(product, qty?)`, `.remove(id)`, `.clear()`, `.items`, `.count`, `.formatText()`

## Tasks

### Task 1: Создать модуль списка покупок

**What:** Реактивный state с массивом товаров, методами add/remove/clear и форматированием текста для менеджера.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/stores/cart.svelte.js`
**How:**
Создать файл (расширение `.svelte.js` обязательно для runes):

```javascript
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

  updateQty(id, qty) {
    const item = items.find(i => i.id === id);
    if (item) {
      if (qty <= 0) {
        items = items.filter(i => i.id !== id);
      } else {
        item.qty = qty;
      }
    }
  },

  clear() {
    items = [];
  },

  formatText() {
    if (items.length === 0) return "";
    const lines = items.map(i =>
      `${i.article} — ${i.name}${i.qty > 1 ? " (" + i.qty + " " + (i.unit || "шт") + ")" : ""}`
    );
    return "Список товаров:\n" + lines.join("\n");
  }
};
```

**Done when:** `grep "export const cart" c:/Users/ikoko/Projects/ZalAssist/src/lib/stores/cart.svelte.js` находит экспорт

### Task 2: Создать утилиту копирования в буфер обмена

**What:** Функция `copyToClipboard(text)` с fallback через textarea + execCommand для iOS Safari и старых браузеров.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/utils/clipboard.js`
**How:**
Создать файл с содержимым из RESEARCH.md (раздел Clipboard API):
- Сначала попробовать `navigator.clipboard.writeText(text)`
- При ошибке — fallback: создать textarea, `position: fixed; left: -9999px`, `focus()`, `select()`, `document.execCommand("copy")`, удалить textarea
- Возвращает `true`/`false`

Важно: вызывающий код НЕ должен использовать `await` перед вызовом `copyToClipboard` — вызов должен быть синхронным из onclick для iOS Safari.

**Done when:** `grep "export async function copyToClipboard" c:/Users/ikoko/Projects/ZalAssist/src/lib/utils/clipboard.js` находит экспорт

## Tests Required

- Вручную: `cart.add({ id: 1, article: "X", name: "Test", unit: "шт" })` увеличивает `cart.count` до 1
- Вручную: повторный `cart.add` того же id увеличивает qty, не создает дубль
- Вручную: `cart.formatText()` возвращает строку с артикулами

## Definition of Done

- [ ] Файл `src/lib/stores/cart.svelte.js` существует, экспортирует `cart` с методами add, remove, updateQty, clear, formatText
- [ ] Файл `src/lib/utils/clipboard.js` существует, экспортирует `copyToClipboard`
- [ ] `npm run build` завершается без ошибок
