---
phase: 3
plan: ai-client
wave: 1
requires: []
req_ids: [CHAT-04, CHAT-03]
status: pending
---

# Plan: AI Client (SSE клиент + формирование промпта + парсинг артикулов)

## Objective

Создать клиентские модули для взаимодействия с Worker: формирование компактного каталога для отправки, SSE-стриминг ответов, парсинг артикулов из финального ответа ИИ. Эти модули не зависят от UI и могут разрабатываться параллельно с Worker.

## Context

- Read: `docs/phases/phase-3/RESEARCH.md`
- Read: `src/lib/data/catalog.js` — loadCatalog() возвращает `{ items, lastUpdated }`
- Read: `src/lib/stores/cart.svelte.js` — cart.add(product)
- Каталог: 74 товара. Компактный формат: `article | name | category | inStock`
- SSE формат OpenRouter: `data: {"choices":[{"delta":{"content":"..."}}]}`, завершение `data: [DONE]`
- Парсинг артикулов: `text.includes(article)` для каждого артикула. ТОЛЬКО после onDone.

## Tasks

### Task 1: Создать src/lib/ai/prompt.js — формирование каталога для отправки

**What:** Модуль, который преобразует массив товаров из catalog.json в компактный текстовый формат для отправки на Worker.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/ai/prompt.js`

**How:**

```js
/**
 * Преобразовать массив товаров в компактный формат для system prompt.
 * Формат: article | name | category | inStock
 * @param {Array} items — items из catalog.json
 * @returns {string}
 */
export function formatCatalogForAI(items) {
  return items.map(item =>
    `${item.article} | ${item.name} | ${item.category} | ${item.inStock ? "да" : "нет"}`
  ).join("\n");
}
```

Одна функция, один экспорт. Без зависимостей.

**Done when:** `grep "formatCatalogForAI" src/lib/ai/prompt.js` находит экспорт.

---

### Task 2: Создать src/lib/ai/client.js — SSE клиент к Worker

**What:** Модуль с функцией `streamChat({ message, history, catalog, onChunk, onDone, onError })` — отправляет POST к Worker и читает SSE-стрим.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/ai/client.js`

**How:**

```js
const WORKER_URL = "https://zalassist-api.<account>.workers.dev/chat";
// TODO: заменить <account> на реальный субдомен после первого деплоя Worker

/**
 * Отправить сообщение и стримить ответ.
 * @param {Object} params
 * @param {string} params.message — сообщение пользователя (до 500 символов)
 * @param {Array} params.history — история [{role, content}], макс 20
 * @param {string} params.catalog — компактный каталог (из formatCatalogForAI)
 * @param {function} params.onChunk — вызывается с каждым фрагментом текста
 * @param {function} params.onDone — вызывается с полным текстом ответа
 * @param {function} params.onError — вызывается при ошибке
 * @returns {function} abort — функция отмены запроса
 */
export function streamChat({ message, history, catalog, onChunk, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, catalog }),
        signal: controller.signal
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 429) {
          onError("Слишком много запросов. Подождите немного.");
        } else if (response.status === 400) {
          onError(err.error || "Некорректный запрос");
        } else {
          onError("Сервис временно недоступен");
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith(":")) continue; // SSE comment / keep-alive
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") {
            onDone(fullText);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content, fullText);
            }
          } catch {
            // Невалидный JSON — пропустить
          }
        }
      }

      // Если стрим завершился без [DONE]
      if (fullText) onDone(fullText);
    } catch (err) {
      if (err.name === "AbortError") return;
      onError("Ошибка соединения. Проверьте интернет.");
    }
  })();

  return () => controller.abort();
}
```

**Ключевые моменты:**
- Возвращает функцию `abort` для отмены запроса (при уходе со страницы)
- SSE comments (строки с `:`) игнорируются
- `data: [DONE]` проверяется ДО JSON.parse
- Ошибки HTTP 429, 400, 5xx — разные сообщения пользователю
- AbortError не показывается пользователю

**Done when:** `grep "streamChat" src/lib/ai/client.js` находит экспорт. `grep "data: \\[DONE\\]" src/lib/ai/client.js` находит проверку.

---

### Task 3: Создать src/lib/ai/parse.js — парсинг артикулов из ответа ИИ

**What:** Модуль с функцией `extractProducts(text, catalogItems)` — находит упомянутые артикулы в тексте ответа ИИ и возвращает соответствующие товары из каталога.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/lib/ai/parse.js`

**How:**

```js
/**
 * Найти товары из каталога, упомянутые в тексте ИИ.
 * Вызывать ТОЛЬКО после onDone (полный текст), не во время стриминга.
 *
 * @param {string} text — полный текст ответа ИИ
 * @param {Array} catalogItems — items из catalog.json
 * @returns {Array} — массив товаров из каталога, найденных в тексте
 */
export function extractProducts(text, catalogItems) {
  if (!text || !catalogItems) return [];

  const upperText = text.toUpperCase();
  const found = [];

  for (const item of catalogItems) {
    if (!item.article) continue;
    const upperArticle = item.article.toUpperCase();
    if (upperArticle.length >= 3 && upperText.includes(upperArticle)) {
      found.push(item);
    }
  }

  return found;
}
```

**Ключевые моменты:**
- Case-insensitive сравнение через toUpperCase()
- Минимальная длина артикула 3 символа (защита от ложных совпадений)
- Простой `includes` — достаточно для 74 товаров
- Порядок: как в каталоге (стабильный)

**Done when:** `grep "extractProducts" src/lib/ai/parse.js` находит экспорт.

## Tests Required

1. `formatCatalogForAI([{article: "ABC-01", name: "Test", category: "Cat", inStock: true}])` возвращает `"ABC-01 | Test | Cat | да"`
2. `extractProducts("Рекомендую BA47-29-1P-16A", [{article: "BA47-29-1P-16A", ...}])` возвращает массив с этим товаром
3. `extractProducts("нет артикулов", [{article: "XYZ", ...}])` возвращает пустой массив
4. `streamChat` с моком fetch отрабатывает onChunk и onDone корректно

## Definition of Done

- `formatCatalogForAI` преобразует массив товаров в строку формата `article | name | category | inStock`
- `streamChat` читает SSE-стрим, вызывает onChunk посимвольно, onDone с полным текстом
- `streamChat` корректно обрабатывает 429, 400, 502 ошибки
- `extractProducts` находит артикулы из каталога в тексте ответа ИИ
- Парсинг артикулов вызывается ТОЛЬКО после полного получения ответа
