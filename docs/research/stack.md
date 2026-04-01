# Research: Tech Stack для ZalAssist

**Topic:** stack
**Date:** 2026-04-01
**Project:** ZalAssist — PWA ИИ-помощник для клиентов ЭлектроЦентр

---

## Executive Summary

Для ZalAssist оптимален стек: Svelte 5 + Vite 6 (минимальный бандл ~6 KB), Tailwind CSS v4 + DaisyUI 5 (готовые компоненты чата), MiniSearch 7 (клиентский поиск по каталогу), Cloudflare Workers + Wrangler 3 (бэкенд), GitHub Pages (хостинг).

---

## Рекомендованный стек

| Слой | Выбор | Причина |
|------|-------|---------|
| Фреймворк | **Svelte 5 + Vite 6** | Бандл ~6 KB gzip (против 30 KB у Vue). Компилируется без runtime |
| UI | **Tailwind CSS v4 + DaisyUI 5** | CSS-only, готовый `chat-bubble`, 0 JS в бандле от UI |
| PWA | **vite-plugin-pwa 0.21** | Zero-config Service Worker, поддержка Svelte |
| Поиск | **MiniSearch 7** | Инвертированный индекс, кириллица, 14 KB |
| Бэкенд | **Cloudflare Workers + Wrangler 3** | Free 100k req/день, секреты через `wrangler secret put` |
| Хостинг | **GitHub Pages + Actions** | Бесплатно, HTTPS |
| ИИ | **OpenRouter API** (через Worker) | Ключ на сервере, не виден клиенту |

## Критические решения

**Svelte vs Vue:** Svelte выигрывает по размеру бандла в 5 раз (6 KB vs 30 KB). На мобильном интернете в зале — разница между 0.5 сек и 2+ сек первой загрузки.

**MiniSearch vs Fuse.js:** Fuse.js перебирает весь каталог при каждом поиске — медленно при >500 записей. MiniSearch строит индекс один раз, поиск мгновенный. Кириллица работает через Unicode-токенизатор.

**OpenRouter через Workers:** API-ключ нельзя класть в фронтенд. Worker скрывает ключ, добавляет rate limiting, поддерживает SSE-стриминг.

**GitHub Pages + `.nojekyll`:** Без этого файла GitHub ломает пути к ресурсам. Base path в Vite должен совпадать с именем репозитория.

## Открытые вопросы

1. Имя репозитория на GitHub (определяет base-путь и URL QR-кода)
2. Количество SKU в каталоге (если >50k — нужен серверный поиск)
3. Формат выгрузки из 1С (CSV или JSON, какие поля)

## Sources

- Svelte 5 Official Docs: https://svelte.dev/
- vite-plugin-pwa: https://github.com/vite-pwa/vite-plugin-pwa
- DaisyUI 5: https://daisyui.com/docs/changelog/
- MiniSearch: https://github.com/lucaong/minisearch
- Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
- OpenRouter Streaming: https://openrouter.ai/docs/api/reference/streaming
