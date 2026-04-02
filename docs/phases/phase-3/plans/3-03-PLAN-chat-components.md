---
phase: 3
plan: chat-components
wave: 2
requires: [ai-client]
req_ids: [CHAT-01, CHAT-02, CHAT-04]
status: pending
---

# Plan: Chat UI компоненты (ChatMessage, QuickChips)

## Objective

Создать UI-компоненты чата: пузырёк сообщения (DaisyUI chat bubble) с поддержкой стриминга и карточек товаров, quick-reply chips для быстрого продолжения диалога. Компоненты используют DaisyUI классы и Svelte 5 runes.

## Context

- Read: `docs/phases/phase-3/RESEARCH.md` — DaisyUI Chat, Svelte 5 Streaming
- Read: `src/lib/components/ProductCard.svelte` — переиспользуется в чате
- Read: `src/lib/stores/cart.svelte.js` — cart.add() для добавления из чата
- DaisyUI: `chat chat-start` (ИИ слева), `chat chat-end` (пользователь справа)
- Иконки: только `lucide-svelte`
- Svelte 5: все state через $state, $derived, $props

## Tasks

### Task 1: Создать src/lib/components/ChatMessage.svelte

**What:** Компонент одного сообщения в чате. Поддерживает: сообщение пользователя, ответ ИИ (с стримингом), карточки товаров, кнопку "Добавить всё в список".

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/components/ChatMessage.svelte`

**How:**

Props (через `$props()`):
- `message` — объект `{ role: "user"|"assistant", content: string, products: Array|null, streaming: boolean }`
- `onadd` — callback `(product) => void` для добавления одного товара
- `onaddall` — callback `(products) => void` для "Добавить всё"
- `cartIds` — `Set<string>` — id товаров уже в корзине (для отображения галочки)

Структура шаблона:
```svelte
<div class="chat {message.role === 'user' ? 'chat-end' : 'chat-start'}">
  <div class="chat-bubble {message.role === 'user' ? 'chat-bubble-primary' : ''}">
    {message.content}
    {#if message.streaming}
      <span class="loading loading-dots loading-xs ml-1"></span>
    {/if}
  </div>
</div>

{#if message.products?.length > 0}
  <div class="px-2 py-1 space-y-2">
    {#each message.products as product (product.id)}
      <ProductCard
        {product}
        inCart={cartIds.has(product.id)}
        onadd={() => onadd?.(product)}
      />
    {/each}
    <button class="btn btn-sm btn-secondary w-full" onclick={() => onaddall?.(message.products)}>
      Добавить всё в список
    </button>
  </div>
{/if}
```

**Ключевые моменты:**
- ИИ — `chat-start` (слева), пользователь — `chat-end chat-bubble-primary` (справа)
- Во время стриминга (`streaming: true`) — показывать loading dots после текста
- Карточки товаров показываются ПОД пузырьком ИИ, только если `products` не пустой
- `onselect` на ProductCard не нужен (в чате не открываем ProductSheet)
- Дисклеймер "Наличие и цены уточняйте у консультанта" НЕ тут (он в ChatPage под всем чатом)

**Done when:** `grep "chat-bubble" src/lib/components/ChatMessage.svelte` находит совпадение. `grep "ProductCard" src/lib/components/ChatMessage.svelte` находит импорт.

---

### Task 2: Создать src/lib/components/QuickChips.svelte

**What:** Компонент с кнопками-подсказками для быстрого продолжения диалога. Появляется после каждого ответа ИИ.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/components/QuickChips.svelte`

**How:**

Props (через `$props()`):
- `chips` — массив строк, например `["Что ещё нужно?", "Расскажи подробнее", "Покажи аналоги"]`
- `onselect` — callback `(chipText: string) => void`
- `disabled` — boolean (disabled во время стриминга)

Шаблон:
```svelte
<div class="flex flex-wrap gap-2 px-4 py-2">
  {#each chips as chip}
    <button
      class="btn btn-sm btn-outline btn-primary"
      {disabled}
      onclick={() => onselect?.(chip)}
    >
      {chip}
    </button>
  {/each}
</div>
```

**Chips logic:** Набор chips зависит от контекста:
- Начальные (приветственные): `["Нужна помощь с электрикой", "Собираю щиток", "Что выбрать для розеток?"]`
- После ответа с товарами: `["Что ещё нужно?", "Покажи аналоги", "Добавить всё в список"]`
- После уточняющего вопроса: контекстно-зависимые (формируются в ChatPage)

Экспортировать также наборы chips:
```js
export const INITIAL_CHIPS = [
  "Нужна помощь с электрикой",
  "Собираю щиток",
  "Что выбрать для розеток?"
];

export const FOLLOWUP_CHIPS = [
  "Что ещё понадобится?",
  "Покажи аналоги",
  "Спасибо, этого достаточно"
];
```

**Done when:** `grep "QuickChips" src/lib/components/QuickChips.svelte` или `grep "INITIAL_CHIPS" src/lib/components/QuickChips.svelte` находит совпадение.

## Tests Required

1. ChatMessage с `role: "user"` рендерит `chat-end`
2. ChatMessage с `role: "assistant"` рендерит `chat-start`
3. ChatMessage с `streaming: true` показывает loading dots
4. ChatMessage с `products: [...]` рендерит ProductCard компоненты
5. QuickChips рендерит кнопки из массива chips
6. QuickChips с `disabled: true` делает кнопки неактивными

## Definition of Done

- ChatMessage корректно отображает сообщения пользователя и ИИ в DaisyUI chat bubble
- Во время стриминга виден индикатор загрузки
- Карточки ProductCard отображаются под ответом ИИ когда есть найденные товары
- Кнопка "Добавить всё в список" присутствует под карточками
- QuickChips отображает кнопки и вызывает onselect при клике
- Все компоненты используют DaisyUI классы и Svelte 5 runes ($props)
