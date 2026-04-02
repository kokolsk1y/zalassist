# Phase 3 Context

**Phase:** 3 — ИИ-диалог
**Discussion date:** 2026-04-02
**Status:** ready-to-plan

## Decisions

### Аккаунт Cloudflare
**Decision:** Аккаунт создан, wrangler авторизован.
**Implications:** Worker деплоится через `npx wrangler deploy`. Секрет API-ключа добавляется через `npx wrangler secret put OPENROUTER_API_KEY`.

### Модель ИИ
**Decision:** Claude Haiku 3.5 через OpenRouter. Model ID: `anthropic/claude-3.5-haiku`
**Rationale:** Лучшее качество ответов среди бюджетных моделей, хорошо работает с русским языком и техническими терминами. ~8000 диалогов за $10.
**Implications:** 
- OpenRouter endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Model: `anthropic/claude-3.5-haiku`
- API-ключ хранится как секрет в Cloudflare Worker, НЕ в коде

### Формат ответа ИИ в чате
**Decision:** Текст + карточки товаров из каталога + точечное добавление ("+" на карточке) + кнопка "Добавить всё в список"
**Rationale:** Паттерн Lowe's Mylow — карточки в чате. Клиент может выбрать конкретные товары или добавить все сразу. Профессиональный вид.
**Implications:**
- ИИ в ответе упоминает артикулы из каталога
- Фронтенд парсит артикулы из ответа ИИ и подтягивает карточки ProductCard из catalog.json
- Под блоком карточек — кнопка "Добавить всё в список"
- Переиспользуем ProductCard из Phase 2

### System prompt — поведение ИИ
**Decision:** Умеренный + честный. Отвечает про электротехнику, объясняет базовые вещи, товары ТОЛЬКО из каталога, если не знает — говорит "обратитесь к консультанту магазина". Никогда не выдумывает.
**Rationale:** Клиент может задать обучающий вопрос — полезный ответ повышает доверие. Но галлюцинации = потеря доверия навсегда.
**Implications:**
- System prompt включает: роль, ограничения, каталог (топ-N товаров из MiniSearch)
- Инструкция: "Если ты не уверен или у тебя недостаточно информации — прямо скажи об этом и посоветуй обратиться к сотруднику магазина"
- Инструкция: "Рекомендуй ТОЛЬКО товары из предоставленного каталога. Если подходящего товара нет — скажи об этом"
- Максимум 2 уточняющих вопроса до первого результата

## Canonical References

| Reference | File path | Notes |
|-----------|-----------|-------|
| Поисковый движок | src/lib/search/engine.js | createSearchEngine() — используется для pre-filter каталога перед отправкой ИИ |
| Каталог | src/lib/data/catalog.js | loadCatalog() |
| Корзина | src/lib/stores/cart.svelte.js | cart.add() для добавления из чата |
| ProductCard | src/lib/components/ProductCard.svelte | Переиспользовать в чате |
| Заглушка чата | src/routes/chat/+page.svelte | Заменить на полноценный чат |
| Clipboard | src/lib/utils/clipboard.js | Для копирования из чата |

## Code Insights

- MiniSearch pre-filter: перед отправкой запроса к ИИ прогнать через engine.search() → топ 20-30 товаров передать в system prompt
- SSE стриминг: Worker отдаёт ответ по частям (Server-Sent Events), фронтенд показывает посимвольно
- Rate limit: 20 запросов/IP/час на Worker
- Лимит запроса: 500 символов на бэкенде
- Prefix caching: system prompt в начале промпта для экономии токенов

## Deferred Ideas

- Cloudflare AI Gateway (кэширование ИИ-запросов) — можно добавить позже
- Голосовой ввод — V2
- История диалогов между сессиями — V2
