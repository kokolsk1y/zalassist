---
phase: 2
plan: homepage-and-cart-panel
wave: 3
requires: [search-ui]
req_ids: [SEARCH-01, SEARCH-04, UI-06]
status: pending
---

# Plan: Доработка главной страницы + панель "Показать менеджеру"

## Objective

Подключить поле ввода на главной к поиску (Enter -> /search/?q=), превратить чипсы в ссылки на категории, создать компонент CartPanel с крупным списком артикулов, кнопкой "Скопировать" и stepper для количества.

## Context

- Главная: `src/routes/+page.svelte` — input без обработчика, chips как `<button>` без ссылок
- Зависимости (Wave 1-2): cart module, clipboard utility, search page
- `goto` из `$app/navigation`, `base` из `$app/paths`
- Trailing slash: URL должны заканчиваться на `/` -> `/search/?q=...`
- Маппинг чипсов -> категорий: определен в plan search-ui, здесь chips становятся `<a>` ссылками
- CartPanel: модальное окно (fullscreen modal), не отдельная страница — пользователь не теряет контекст
- Копирование: синхронный вызов `copyToClipboard()` из onclick (iOS Safari)
- Чип "Инструмент" — убрать если категории нет в каталоге

## Tasks

### Task 1: Добавить обработчик поиска на главной

**What:** Input на главной странице: при Enter — `goto(base + '/search/?q=' + encodeURIComponent(value))`. Обернуть в `<form onsubmit={handleSearch}>`.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/+page.svelte`
**How:**

Прочитать текущий файл. Изменения:
1. Добавить импорты:
```javascript
import { goto } from "$app/navigation";
```
2. Добавить state и обработчик:
```javascript
let searchInput = $state("");

function handleSearch(e) {
  e.preventDefault();
  if (searchInput.trim()) {
    goto(`${base}/search/?q=${encodeURIComponent(searchInput.trim())}`);
  }
}
```
3. Обернуть input в form:
```svelte
<form onsubmit={handleSearch} class="w-full max-w-md mb-6">
  <input
    type="text"
    bind:value={searchInput}
    placeholder="Артикул, название или задача..."
    class="input input-bordered input-lg w-full bg-base-100 shadow-md focus:border-primary focus:shadow-lg transition-all"
  />
</form>
```

**Done when:** `grep "handleSearch" c:/Users/ikoko/Projects/ZalAssist/src/routes/+page.svelte` находит функцию

### Task 2: Превратить чипсы в ссылки на категории

**What:** Заменить `<button>` чипсы на `<a>` ссылки, ведущие на `/search/?category=`. Убрать чип "Инструмент" если категории нет в каталоге, или заменить на реальную категорию.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/+page.svelte`
**How:**

Заменить массив строк на массив объектов:
```javascript
const chips = [
  { label: "Автоматы", category: "Автоматы" },
  { label: "Кабель", category: "Кабель" },
  { label: "Розетки", category: "Розетки" },
  { label: "Щиты", category: "Щиты" },
  { label: "Освещение", category: "Освещение" },
  { label: "УЗО", category: "УЗО" },
];
```

Заменить разметку чипсов:
```svelte
<div class="flex flex-wrap gap-2 mt-8 justify-center max-w-md">
  {#each chips as chip}
    <a href="{base}/search/?category={encodeURIComponent(chip.category)}"
       class="badge badge-outline badge-lg py-3 px-4 cursor-pointer hover:bg-primary hover:text-primary-content transition-colors no-underline">
      {chip.label}
    </a>
  {/each}
</div>
```

Категория в query param — короткое имя (label чипа). Маппинг на полное название происходит на странице /search/ (Task 4 из plan search-ui).

**Done when:** `grep 'href="{base}/search/' c:/Users/ikoko/Projects/ZalAssist/src/routes/+page.svelte` находит ссылки чипсов

### Task 3: Создать компонент CartPanel

**What:** Fullscreen modal с крупным списком товаров для менеджера. Каждый товар: артикул (крупно, моно), название, qty stepper (+/-), кнопка удалить. Внизу: кнопка "Скопировать список" и "Очистить".
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/components/CartPanel.svelte`
**How:**

Props:
- `open` — boolean, показывать ли панель
- `onclose` — callback при закрытии

Импорты:
```javascript
import { cart } from "$lib/stores/cart.svelte.js";
import { copyToClipboard } from "$lib/utils/clipboard.js";
import { X, Minus, Plus, Trash2, Copy, Check } from "lucide-svelte";
```

State:
```javascript
let copied = $state(false);
let dialog;
```

Effect для управления dialog:
```javascript
$effect(() => {
  if (open) dialog?.showModal();
  else dialog?.close();
});
```

Разметка — `<dialog class="modal">` (fullscreen, не bottom):
```svelte
<dialog bind:this={dialog} class="modal" onclose={onclose}>
  <div class="modal-box w-full max-w-lg h-full max-h-full sm:max-h-[90vh] sm:rounded-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">Список для менеджера</h2>
      <button class="btn btn-ghost btn-sm btn-circle" onclick={onclose}>
        <X size={20} />
      </button>
    </div>

    <!-- Пустой список -->
    {#if cart.count === 0}
      <p class="text-center text-base-content/50 py-12">Список пуст</p>
    {:else}
      <!-- Товары -->
      <div class="space-y-3 mb-6">
        {#each cart.items as item (item.id)}
          <div class="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
            <div class="flex-1">
              <p class="font-mono text-lg font-bold">{item.article}</p>
              <p class="text-sm text-base-content/70">{item.name}</p>
            </div>
            <div class="flex items-center gap-1">
              <button class="btn btn-ghost btn-xs btn-circle"
                      onclick={() => cart.updateQty(item.id, item.qty - 1)}>
                <Minus size={14} />
              </button>
              <span class="w-8 text-center font-bold">{item.qty}</span>
              <button class="btn btn-ghost btn-xs btn-circle"
                      onclick={() => cart.updateQty(item.id, item.qty + 1)}>
                <Plus size={14} />
              </button>
              <button class="btn btn-ghost btn-xs btn-circle text-error"
                      onclick={() => cart.remove(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        {/each}
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <button class="btn btn-primary flex-1 gap-2"
                onclick={() => {
                  copyToClipboard(cart.formatText());
                  copied = true;
                  setTimeout(() => copied = false, 2000);
                }}>
          {#if copied}
            <Check size={18} /> Скопировано!
          {:else}
            <Copy size={18} /> Скопировать список
          {/if}
        </button>
        <button class="btn btn-ghost" onclick={() => cart.clear()}>
          Очистить
        </button>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

Важно: кнопка "Скопировать" вызывает `copyToClipboard(cart.formatText())` СИНХРОННО из onclick (не после await). `copied` state дает визуальную обратную связь на 2 секунды.

**Done when:** `grep "CartPanel" c:/Users/ikoko/Projects/ZalAssist/src/lib/components/CartPanel.svelte` — файл существует и содержит `copyToClipboard`

### Task 4: Интеграция CartPanel в страницу поиска

**What:** Импортировать CartPanel в `/search/+page.svelte`, добавить кнопку-счетчик корзины в header, по клику — открыть CartPanel.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/search/+page.svelte`
**How:**

Добавить импорт:
```javascript
import CartPanel from "$lib/components/CartPanel.svelte";
```

Добавить state:
```javascript
let showCart = $state(false);
```

Добавить в разметку (после header/перед результатами):
```svelte
<CartPanel open={showCart} onclose={() => showCart = false} />
```

Кнопка-счетчик уже должна быть в search page (Task 3 plan search-ui). Убедиться что при клике: `showCart = true`.

**Done when:** `grep "CartPanel" c:/Users/ikoko/Projects/ZalAssist/src/routes/search/+page.svelte` находит импорт

## Tests Required

- На главной: Enter в поле ввода -> переход на /search/?q=текст
- На главной: клик на чип "Автоматы" -> переход на /search/?category=Автоматы
- CartPanel: добавить товар -> виден в панели, артикул крупным шрифтом
- CartPanel: +/- меняет qty, при qty=0 товар удаляется
- CartPanel: "Скопировать список" -> текст в буфере обмена (проверить на iOS Safari)
- CartPanel: кнопка показывает "Скопировано!" на 2 секунды

## Definition of Done

- [ ] Input на главной обрабатывает Enter -> переход на /search/?q=
- [ ] Чипсы на главной — ссылки `<a>` на /search/?category=
- [ ] Чип "Инструмент" убран (или заменен на реальную категорию из каталога)
- [ ] `src/lib/components/CartPanel.svelte` существует с полным UI
- [ ] CartPanel подключен к странице поиска
- [ ] Кнопка "Скопировать" работает синхронно (iOS Safari совместимость)
- [ ] `npm run build` завершается без ошибок
