---
phase: 3
plan: worker
wave: 1
requires: []
req_ids: [ARCH-01, ARCH-03, SEC-01, SEC-02]
status: pending
---

# Plan: Cloudflare Worker (прокси + rate limit + SSE)

## Objective

Создать Cloudflare Worker, который принимает запросы от фронтенда, валидирует их, применяет rate limiting, формирует system prompt с каталогом и проксирует SSE-стрим от OpenRouter к клиенту. API-ключ хранится как секрет Worker, клиент никогда его не видит.

## Context

- Read: `docs/phases/phase-3/CONTEXT.md`
- Read: `docs/phases/phase-3/RESEARCH.md`
- Модель: `anthropic/claude-3.5-haiku` через OpenRouter
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Каталог: 74 товара, ~2500 токенов, компактный формат `article | name | category | inStock`
- Rate limit: 20 req/IP/час
- max_tokens: 1024, temperature: 0.3
- Prefix caching: `cache_control: { type: "ephemeral" }` на system message
- ARCH-02 (AI Gateway) ОТЛОЖЕН

## Tasks

### Task 1: Создать wrangler.toml

**What:** Создать файл `worker/wrangler.toml` с конфигурацией Worker.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/worker/wrangler.toml`

**How:** Содержимое:

```toml
name = "zalassist-api"
main = "index.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1"
simple = { limit = 20, period = 3600 }
```

**Done when:** Файл существует, содержит `name = "zalassist-api"` и `RATE_LIMITER`.

---

### Task 2: Создать worker/prompts.js — system prompt и формат каталога

**What:** Модуль с функциями `buildSystemPrompt(catalogCompact)` и `formatCatalogCompact(catalogItems)`.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/worker/prompts.js`

**How:**

- `formatCatalogCompact(items)` — принимает массив `[{article, name, category, inStock}]`, возвращает строку в формате `article | name | category | inStock` по одной строке на товар.
- `buildSystemPrompt(catalogCompact)` — возвращает объект system message:
  ```js
  {
    role: "system",
    content: SYSTEM_PROMPT_TEXT.replace("{catalog}", catalogCompact),
    cache_control: { type: "ephemeral" }
  }
  ```
- Текст system prompt — точно как в RESEARCH.md (секция "System Prompt").

**Done when:** `grep "cache_control" worker/prompts.js` находит строку. `grep "buildSystemPrompt" worker/prompts.js` находит экспорт.

---

### Task 3: Создать worker/index.js — основной Worker

**What:** Единый файл Worker: обработка CORS, валидация, rate limiting, формирование запроса к OpenRouter, проксирование SSE.

**Where:** `c:/Users/ikoko/Projects/ZalAssist/worker/index.js`

**How:**

Структура:

```js
import { buildSystemPrompt, formatCatalogCompact } from "./prompts.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    // 1. OPTIONS preflight → return 204 с CORS
    // 2. Только POST /chat
    // 3. Rate limit check (env.RATE_LIMITER)
    // 4. Parse JSON body: { message, history, catalog }
    // 5. Validate: message.length <= 500, history.length <= 20
    // 6. Build system prompt с каталогом из body.catalog
    // 7. Fetch OpenRouter с stream: true
    // 8. Proxy ReadableStream с CORS headers
  }
};
```

Детали реализации:

**CORS preflight (OPTIONS):**
```js
if (request.method === "OPTIONS") {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
```

**Rate limiting:**
```js
const ip = request.headers.get("CF-Connecting-IP") || "unknown";
let limited = false;
try {
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  limited = !success;
} catch {
  // Fallback: пропустить если binding не работает
}
if (limited) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
```

**Валидация (SEC-01):**
- `message` обязателен, строка, длина <= 500 символов → иначе 400
- `history` — массив, длина <= 20 → иначе обрезать до последних 20
- `catalog` — строка (компактный каталог) → обязательна

**Запрос к OpenRouter:**
```js
const systemMsg = buildSystemPrompt(body.catalog);
const messages = [systemMsg, ...body.history, { role: "user", content: body.message }];

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://zalassist.github.io",
    "X-Title": "ZalAssist"
  },
  body: JSON.stringify({
    model: "anthropic/claude-3.5-haiku",
    messages,
    stream: true,
    max_tokens: 1024,
    temperature: 0.3
  })
});
```

**Проксирование SSE:**
```js
return new Response(response.body, {
  status: 200,
  headers: {
    ...CORS_HEADERS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache"
  }
});
```

**Обработка ошибок:** Если OpenRouter вернул не 200 — прочитать body, вернуть 502 с `{ error: "AI service unavailable" }`.

**Done when:**
- `grep "RATE_LIMITER" worker/index.js` — найдена строка
- `grep "text/event-stream" worker/index.js` — найдена строка
- `grep "openrouter.ai" worker/index.js` — найдена строка
- `grep "500" worker/index.js` — найдена проверка длины сообщения

---

### Task 4: Добавить .gitignore для worker и документировать деплой

**What:** Добавить правила в `.gitignore` для worker (node_modules, .wrangler). Создать `worker/README-deploy.md` с инструкцией деплоя.

**Where:** 
- Редактировать `c:/Users/ikoko/Projects/ZalAssist/.gitignore` — добавить строки `worker/.wrangler/` и `worker/node_modules/`
- Создать `c:/Users/ikoko/Projects/ZalAssist/worker/package.json`

**How:**

`worker/package.json`:
```json
{
  "name": "zalassist-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

**Done when:** Файл `worker/package.json` существует. `.gitignore` содержит `worker/.wrangler`.

## Tests Required

1. `npx wrangler dev` в директории worker запускается без ошибок синтаксиса
2. `curl -X OPTIONS http://localhost:8787/chat` возвращает 204 с CORS headers
3. `curl -X POST http://localhost:8787/chat -d '{"message":"тест длиннее 500 символов..."}' -H "Content-Type: application/json"` с сообщением > 500 символов → 400
4. `curl -X POST http://localhost:8787/chat -d '{"message":"нужен автомат","history":[],"catalog":"..."}' -H "Content-Type: application/json"` → 200, SSE stream

## Definition of Done

- Worker запускается локально через `wrangler dev`
- CORS preflight отвечает 204
- Сообщение > 500 символов отклоняется с 400
- Rate limit работает (20 req/IP/час)
- System prompt содержит каталог и cache_control
- SSE стрим проксируется от OpenRouter к клиенту
- API-ключ не в коде, только через `env.OPENROUTER_API_KEY`
