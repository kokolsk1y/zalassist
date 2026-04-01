# Research: Architecture для ZalAssist

**Topic:** architecture
**Date:** 2026-04-01
**Project:** ZalAssist — PWA с ИИ для клиентов ЭлектроЦентр

---

## Executive Summary

Двухуровневая статическая архитектура: GitHub Pages (PWA) + Cloudflare Workers (прокси к ИИ). Каталог — статический JSON на GitHub Pages, загружается в браузер целиком. Контекстная стратегия для ИИ — гибридная: клиентская фильтрация (MiniSearch) сужает каталог до 20-50 позиций → передаются в промпт. Cloudflare AI Gateway даёт бесплатное кэширование. При росте — миграция на Cloudflare Pages без изменения логики.

---

## Архитектура

```
[Телефон клиента]
       │  QR → PWA
       ▼
[GitHub Pages: static PWA]
  ├── index.html + JS bundle
  ├── catalog.json (каталог из 1С)
  ├── manifest.json
  └── sw.js (Service Worker)
       │  fetch() к API
       ▼
[Cloudflare Workers: edge proxy]
  ├── Добавляет system prompt + API key
  ├── Проксирует через AI Gateway → OpenRouter
  └── Rate limiting
```

## Хранение каталога

**Рекомендовано: JSON на GitHub Pages** (для v1)
- catalog.json раздаётся как статика, кэшируется Service Worker
- 10 000 SKU × ~300 байт ≈ 3 MB — норма
- Обновление: git push нового файла

**Альтернативы на будущее:** Cloudflare KV (частые обновления), R2 (изображения).

## Контекстная стратегия для ИИ

**Client-Side Pre-filter + Compact Context:**
1. Пользователь вводит запрос
2. MiniSearch на клиенте → топ 20-50 товаров
3. Cloudflare Worker: system prompt + 30 товаров + история (3-5 сообщений) + запрос
4. **~3 200 токенов на запрос**

| Стратегия | Стоимость/запрос | Качество |
|-----------|------------------|----------|
| Client pre-filter (рекомендован) | ~$0.001 | Высокое |
| Полный каталог в промпт | ~$0.01-0.05 | Среднее (lost-in-middle) |
| RAG с векторной базой | ~$0.002 + инфраструктура | Высокое |

## Кэширование (3 уровня)

1. **Cloudflare AI Gateway** — exact-match кэш бесплатно (TTL 1ч для диалогов, 24ч для поиска)
2. **Prefix Caching (Anthropic)** — system prompt кэшируется, повторные запросы = 10% цены
3. **sessionStorage в браузере** — повторный поиск того же артикула не идёт к API

**Экономия:** $10 растягивается с ~3 100 до ~12 500 диалогов.

## Офлайн-стратегия

- **Cache-First:** статика (HTML, JS, CSS)
- **Stale-While-Revalidate:** catalog.json
- **Network-Only:** ИИ-запросы (с graceful fallback "ИИ недоступен")
- **Офлайн работает:** каталог, поиск (MiniSearch), комплекты
- **Не работает офлайн:** ИИ-диалог

## Структура проекта

```
zalassist/
├── public/
│   ├── catalog.json
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── components/    (ChatInterface, CatalogSearch, KitSelector)
│   ├── services/      (ai.js, catalog.js, search.js)
│   └── app.js
├── worker/
│   ├── index.js
│   ├── prompts.js
│   └── wrangler.toml
└── scripts/
    └── convert-catalog.js
```

## Масштабирование

- **Фаза 0:** GitHub Pages + Workers Free (~500 users/day)
- **Фаза 1:** Cloudflare Pages (без лимитов bandwidth)
- **Фаза 2:** Workers KV (обновление без git push)
- **Фаза 3:** D1 + Webhooks из 1С (real-time)

## Sources

- Cloudflare AI Gateway Caching: https://developers.cloudflare.com/ai-gateway/features/caching/
- OpenRouter Prompt Caching: https://openrouter.ai/docs/guides/best-practices/prompt-caching
- Cloudflare Storage Options: https://developers.cloudflare.com/workers/platform/storage-options/
- MDN PWA Caching: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
