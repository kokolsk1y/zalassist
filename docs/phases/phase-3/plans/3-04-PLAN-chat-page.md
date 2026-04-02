---
phase: 3
plan: chat-page
wave: 3
requires: [worker, ai-client, chat-components]
req_ids: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, SEC-01]
status: pending
---

# Plan: Chat Page (интеграция всех модулей)

## Objective

Заменить заглушку `src/routes/chat/+page.svelte` на полноценный чат с ИИ. Интегрировать все модули: streamChat для SSE, formatCatalogForAI для каталога, extractProducts для парсинга, ChatMessage и QuickChips для UI. Добавить auto-scroll, лимит символов, дисклеймер.

## Context

- Read: `src/routes/chat/+page.svelte` — текущая заглушка, ЗАМЕНИТЬ полностью
- Read: `src/lib/data/catalog.js` — loadCatalog()
- Read: `src/lib/stores/cart.svelte.js` — cart.add()
- Read: `src/lib/ai/client.js` — streamChat (создаётся в wave 1)
- Read: `src/lib/ai/prompt.js` — formatCatalogForAI (создаётся в wave 1)
- Read: `src/lib/ai/parse.js` — extractProducts (создаётся в wave 1)
- Read: `src/lib/components/ChatMessage.svelte` — (создаётся в wave 2)
- Read: `src/lib/components/QuickChips.svelte` — (создаётся в wave 2)
- Паттерны: $state, $derived, $effect, {base}/path, lucide-svelte

## Tasks

### Task 1: Заменить src/routes/chat/+page.svelte на полноценный чат

**What:** Полная замена заглушки. Страница чата с ИИ: ввод сообщения, отправка, стриминг ответа, карточки товаров, quick-reply, добавление в корзину.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/chat/+page.svelte`

**How:**

**State (через $state):**
```js
let messages = $state([]);          // Array<{role, content, products, streaming}>
let inputText = $state("");         // текст в поле ввода
let isLoading = $state(false);      // идёт стриминг
let error = $state(null);           // текст ошибки
let catalogItems = $state([]);      // товары из каталога
let catalogCompact = $state("");    // компактный каталог для отправки
let abortFn = $state(null);        // функция отмены текущего запроса
```

**Derived:**
```js
let cartIds = $derived(new Set(cart.items.map(i => i.id)));
let canSend = $derived(inputText.trim().length > 0 && inputText.length <= 500 && !isLoading);
let currentChips = $derived(
  messages.length === 0 ? INITIAL_CHIPS :
  isLoading ? [] :
  FOLLOWUP_CHIPS
);
```

**Lifecycle — загрузка каталога:**
```js
import { onMount } from "svelte";
import { loadCatalog } from "$lib/data/catalog.js";
import { formatCatalogForAI } from "$lib/ai/prompt.js";

onMount(async () => {
  const catalog = await loadCatalog();
  catalogItems = catalog.items;
  catalogCompact = formatCatalogForAI(catalog.items);
});
```

**Функция отправки сообщения:**
```js
function sendMessage(text) {
  if (!text?.trim() || isLoading) return;
  const userMsg = text.trim().slice(0, 500);
  inputText = "";
  error = null;

  // Добавить сообщение пользователя
  messages.push({ role: "user", content: userMsg, products: null, streaming: false });

  // Добавить пустое сообщение ИИ (будет заполняться через стриминг)
  const aiMsgIndex = messages.length;
  messages.push({ role: "assistant", content: "", products: null, streaming: true });
  isLoading = true;

  // Формировать history (только role + content, без products/streaming)
  const history = messages.slice(0, -2)
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role, content: m.content }))
    .slice(-20);

  abortFn = streamChat({
    message: userMsg,
    history,
    catalog: catalogCompact,
    onChunk(chunk, fullText) {
      messages[aiMsgIndex].content = fullText;
    },
    onDone(fullText) {
      messages[aiMsgIndex].content = fullText;
      messages[aiMsgIndex].streaming = false;
      messages[aiMsgIndex].products = extractProducts(fullText, catalogItems);
      isLoading = false;
      abortFn = null;
    },
    onError(errMsg) {
      messages[aiMsgIndex].content = errMsg;
      messages[aiMsgIndex].streaming = false;
      isLoading = false;
      error = errMsg;
      abortFn = null;
    }
  });
}
```

**Auto-scroll:**
```js
let chatContainer;

$effect(() => {
  // Зависит от messages (любое изменение)
  const _ = messages.length > 0 && messages[messages.length - 1].content;
  if (chatContainer) {
    requestAnimationFrame(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
  }
});
```

**Обработчики:**
```js
function handleAdd(product) { cart.add(product); }
function handleAddAll(products) { products.forEach(p => cart.add(p)); }
function handleChipSelect(chipText) { sendMessage(chipText); }
function handleKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey && canSend) {
    e.preventDefault();
    sendMessage(inputText);
  }
}
```

**Шаблон (структура):**
```svelte
<div class="flex flex-col h-[100dvh] bg-base-200">
  <!-- Header -->
  <div class="navbar bg-base-100 shadow-sm">
    <a href="{base}/" class="btn btn-ghost btn-sm">
      <ArrowLeft size={20} />
    </a>
    <span class="text-lg font-bold ml-2">Подбор под задачу</span>
  </div>

  <!-- Messages area -->
  <div class="flex-1 overflow-y-auto p-4 space-y-2" bind:this={chatContainer}>
    {#if messages.length === 0}
      <div class="text-center text-base-content/50 mt-8">
        <MessageSquare size={32} class="mx-auto mb-2 opacity-50" />
        <p>Опишите задачу или выберите подсказку</p>
      </div>
    {/if}

    {#each messages as message, i (i)}
      <ChatMessage
        {message}
        {cartIds}
        onadd={handleAdd}
        onaddall={handleAddAll}
      />
    {/each}

    {#if error}
      <div class="alert alert-error text-sm">
        {error}
      </div>
    {/if}
  </div>

  <!-- Quick chips -->
  {#if currentChips.length > 0}
    <QuickChips
      chips={currentChips}
      onselect={handleChipSelect}
      disabled={isLoading}
    />
  {/if}

  <!-- Disclaimer -->
  <p class="text-xs text-base-content/40 text-center px-4">
    Наличие и цены уточняйте у консультанта
  </p>

  <!-- Input area -->
  <div class="p-3 bg-base-100 border-t border-base-300 flex gap-2 items-end">
    <textarea
      class="textarea textarea-bordered flex-1 min-h-[44px] max-h-[120px] resize-none text-base"
      placeholder="Опишите задачу..."
      bind:value={inputText}
      onkeydown={handleKeydown}
      maxlength="500"
      rows="1"
      disabled={isLoading}
    ></textarea>
    <button
      class="btn btn-primary btn-circle"
      onclick={() => sendMessage(inputText)}
      disabled={!canSend}
      aria-label="Отправить"
    >
      <Send size={20} />
    </button>
  </div>

  <!-- Character counter -->
  {#if inputText.length > 400}
    <p class="text-xs text-center pb-1 {inputText.length > 500 ? 'text-error' : 'text-base-content/40'}">
      {inputText.length}/500
    </p>
  {/if}
</div>
```

**Импорты:**
```js
import { base } from "$app/paths";
import { onMount } from "svelte";
import { ArrowLeft, Send, MessageSquare } from "lucide-svelte";
import { loadCatalog } from "$lib/data/catalog.js";
import { formatCatalogForAI } from "$lib/ai/prompt.js";
import { streamChat } from "$lib/ai/client.js";
import { extractProducts } from "$lib/ai/parse.js";
import { cart } from "$lib/stores/cart.svelte.js";
import ChatMessage from "$lib/components/ChatMessage.svelte";
import QuickChips, { INITIAL_CHIPS, FOLLOWUP_CHIPS } from "$lib/components/QuickChips.svelte";
```

**Done when:**
- `grep "streamChat" src/routes/chat/+page.svelte` — найден импорт
- `grep "ChatMessage" src/routes/chat/+page.svelte` — найден импорт
- `grep "QuickChips" src/routes/chat/+page.svelte` — найден импорт
- `grep "extractProducts" src/routes/chat/+page.svelte` — найден импорт
- `grep "Наличие и цены" src/routes/chat/+page.svelte` — найден дисклеймер
- `grep "500" src/routes/chat/+page.svelte` — найден лимит символов

---

### Task 2: Обновить src/routes/+page.svelte — кнопка "Подобрать под задачу" ведёт в чат

**What:** Убедиться, что кнопка "Подобрать под задачу" на главной странице ведёт на `/chat` (а не на заглушку). Проверить что href уже корректный.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/+page.svelte`

**How:** Прочитать файл. Если кнопка уже ведёт на `{base}/chat` — ничего не делать. Если нет — обновить href.

**Done when:** `grep "chat" src/routes/+page.svelte` находит ссылку на чат.

---

### Task 3: Cleanup и scroll — $effect для автоскролла при unmount

**What:** В `+page.svelte` добавить cleanup: при уходе со страницы вызывать `abortFn?.()` для отмены текущего запроса. Авто-скролл должен работать через $effect с requestAnimationFrame, не на каждый символ.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/routes/chat/+page.svelte` (в рамках Task 1)

**How:**

```js
import { onDestroy } from "svelte";

onDestroy(() => {
  abortFn?.();
});
```

Авто-скролл с throttle через requestAnimationFrame уже включён в Task 1 (через $effect).

Для оптимизации: трекать только `messages.length` и `messages[messages.length - 1]?.content?.length` в $effect, чтобы не скроллить на каждый рендер.

**Done when:** `grep "onDestroy" src/routes/chat/+page.svelte` находит импорт. `grep "abortFn" src/routes/chat/+page.svelte` находит cleanup.

## Tests Required

1. Открыть `/chat` — видна пустая страница с подсказкой и quick chips
2. Ввести текст и отправить — сообщение пользователя справа, ответ ИИ стримится слева
3. После ответа — карточки товаров под пузырьком ИИ (если артикулы найдены)
4. Нажать "+" на карточке — товар в корзине
5. Нажать "Добавить всё" — все товары из ответа в корзине
6. Нажать quick chip — отправляется как сообщение
7. Ввести > 500 символов — кнопка отправки заблокирована, счётчик красный
8. При стриминге — кнопка отправки заблокирована, loading dots видны
9. При уходе со страницы — запрос отменяется
10. Дисклеймер "Наличие и цены уточняйте у консультанта" видим внизу

## Definition of Done

- Заглушка `/chat` заменена на полноценный чат
- Сообщения пользователя справа (chat-end), ИИ слева (chat-start)
- SSE-стриминг: текст ИИ появляется посимвольно
- Артикулы парсятся после получения полного ответа → карточки ProductCard
- Quick-reply chips отображаются и работают
- "Добавить всё в список" добавляет товары в cart store
- Лимит 500 символов на ввод с визуальным индикатором
- Дисклеймер UI-05 присутствует
- Auto-scroll к последнему сообщению через requestAnimationFrame
- Cleanup при уходе со страницы (abort запроса)
- `npm run build` проходит без ошибок
