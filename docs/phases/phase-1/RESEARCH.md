# Phase Research: Фундамент и деплой

**Phase:** 1 — Фундамент и деплой
**Date:** 2026-04-01

## Scope

Исследованы пять технически рискованных аспектов Phase 1: конфигурация SvelteKit 5 + adapter-static для GitHub Pages с base path, подключение Tailwind CSS v4 + DaisyUI 5 (CSS-first подход), настройка vite-plugin-pwa для статического адаптера, GitHub Actions workflow для автодеплоя, и генерация QR-кода с UTM-метками.

## Codebase Audit Findings

### Existing Patterns to Follow

Проект greenfield — кода нет. Паттерны устанавливаются этой фазой.

| Pattern | Rule for Planner |
|---------|------------------|
| Файловая структура | SvelteKit стандарт: src/routes/, src/lib/, static/ |
| Стиль компонентов | Svelte 5 runes syntax ($state, $derived, $effect) |
| CSS | Tailwind utility classes + DaisyUI компоненты, кастомная тема в src/app.css |
| Данные | Статический JSON в static/catalog.json |
| Скрипты | scripts/ директория для утилит (convert-catalog.js) |
| Деплой | GitHub Actions -> GitHub Pages |

### Files This Phase Will Create

| File | Purpose |
|------|---------|
| svelte.config.js | SvelteKit config: adapter-static, base path, prerender |
| vite.config.js | Vite plugins: sveltekit, tailwindcss, SvelteKitPWA |
| src/app.css | Tailwind import, DaisyUI plugin, кастомная тема ЭлектроЦентр |
| src/app.html | HTML шаблон: Inter font, meta viewport, theme-color |
| src/routes/+layout.svelte | Root layout: импорт app.css, общая структура |
| src/routes/+layout.js | prerender = true; trailingSlash = "always" |
| src/routes/+page.svelte | Стартовый экран: 3 CTA, suggestion chips |
| src/lib/components/ | UI-компоненты (Header, CatalogDate и др.) |
| src/lib/data/catalog.js | Загрузка и экспорт каталога |
| static/catalog.json | Мок-каталог 50-100 товаров |
| static/.nojekyll | Отключение Jekyll на GitHub Pages |
| static/favicon.png | Иконка приложения |
| .github/workflows/deploy.yml | GitHub Actions workflow |
| scripts/convert-catalog.js | Конвертер CSV/Excel -> catalog.json |
| scripts/generate-mock-catalog.js | Генератор мок-данных |

### Potential Conflicts

Нет конфликтов — greenfield проект. Единственный риск: CLAUDE.md уже есть в корне, его не трогаем.

---

## Recommended Approach

### Decision 1: Конфигурация SvelteKit + adapter-static для GitHub Pages

**Chosen approach:** adapter-static с prerender всех страниц + trailingSlash "always"

#### svelte.config.js

```javascript
import adapter from "@sveltejs/adapter-static";

const config = {
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "404.html",
      strict: false
    }),
    paths: {
      base: process.argv.includes("dev") ? "" : "/zalassist"
    },
    appDir: "app"
  }
};

export default config;
```

**Критические моменты:**

1. **paths.base** — в dev-режиме должен быть пустой строкой, в production — "/zalassist". Используется process.argv.includes("dev") для определения режима.

2. **appDir: "app"** — меняем дефолтный "_app" на "app". GitHub Pages по умолчанию использует Jekyll, который игнорирует директории с подчёркиванием. Хотя .nojekyll решает эту проблему, appDir: "app" — дополнительная страховка.

3. **fallback: "404.html"** — GitHub Pages автоматически показывает 404.html для несуществующих путей. SvelteKit сгенерирует эту страницу.

4. **strict: false** — отключает проверку что все страницы prerendered.

5. **.nojekyll** — файл static/.nojekyll (пустой) обязателен. Без него GitHub Pages обрабатывает контент через Jekyll и ломает пути к ресурсам.

6. **trailingSlash: "always"** — устанавливается в src/routes/+layout.js. Генерирует route/index.html вместо route.html.

#### src/routes/+layout.js

```javascript
export const prerender = true;
export const trailingSlash = "always";
```

**Gotcha с путями в Svelte-компонентах:** Все ссылки и ресурсы внутри .svelte файлов должны использовать base из $app/paths:

```svelte
<script>
  import { base } from "$app/paths";
</script>

<a href="{base}/search">Поиск</a>
<img src="{base}/icons/logo.svg" alt="Logo" />
```

Без {base} ссылки будут работать в dev-режиме, но ломаться на GitHub Pages.

---

### Decision 2: Tailwind CSS v4 + DaisyUI 5

**Chosen approach:** CSS-first конфигурация через @import и @plugin

Tailwind CSS v4 радикально изменил подход к конфигурации: вместо tailwind.config.js все делается в CSS-файле. DaisyUI 5 полностью совместим с Tailwind v4 через директиву @plugin.

#### Установка

```bash
npm install tailwindcss@latest @tailwindcss/vite@latest daisyui@latest
```

**Важно:** НЕ нужен postcss.config.js, НЕ нужен tailwind.config.js. Tailwind v4 работает как Vite-плагин напрямую.

#### vite.config.js (Tailwind часть)

```javascript
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit()
  ]
});
```

**Порядок плагинов важен:** tailwindcss() должен идти ПЕРЕД sveltekit() в массиве plugins.

#### src/app.css — Тема ЭлектроЦентр

```css
@import "tailwindcss";
@plugin "daisyui";

/* Кастомная тема ЭлектроЦентр */
@plugin "daisyui/theme" {
  name: "electrocentr";
  default: true;
  color-scheme: light;

  /* Основной синий — #2b7de0
     ВАЖНО: Конвертировать через https://oklch.com/ для точных значений */
  --color-primary: oklch(58.8% 0.17 248);
  --color-primary-content: oklch(98% 0.01 248);

  /* Оранжевый CTA — #f15a2c */
  --color-secondary: oklch(63.5% 0.21 35);
  --color-secondary-content: oklch(98% 0.01 35);

  /* Акцент (тёмно-синий текст) — #1f2949 */
  --color-accent: oklch(27% 0.05 260);
  --color-accent-content: oklch(98% 0.01 260);

  /* Нейтральные */
  --color-neutral: oklch(27% 0.05 260);
  --color-neutral-content: oklch(98% 0.01 260);

  /* Фоны */
  --color-base-100: oklch(100% 0 0);
  --color-base-200: oklch(97% 0.005 250);
  --color-base-300: oklch(93% 0.01 250);
  --color-base-content: oklch(27% 0.05 260);

  /* Системные */
  --color-info: oklch(58.8% 0.17 248);
  --color-success: oklch(65% 0.17 150);
  --color-warning: oklch(75% 0.15 80);
  --color-error: oklch(55% 0.2 25);

  /* Border radius из дизайн-системы */
  --rounded-box: 12px;
  --rounded-btn: 12px;
  --rounded-badge: 999px;

  /* Анимация */
  --animation-btn: 0.2s;
  --animation-input: 0.2s;
}
```

**ВАЖНО: OKLCH-значения приблизительные.** Точные значения нужно получить через конвертер, вставив hex-коды:
- #2b7de0 -> primary
- #f15a2c -> secondary
- #1f2949 -> accent/neutral
- #f5f7fa -> base-200
- #e0e7f0 -> base-300

Рекомендуемые конвертеры: https://oklch.com/ или https://atmos.style/color-converter/hex-to-oklch

Planner ОБЯЗАН включить задачу: "Конвертировать hex-цвета в OKLCH через oklch.com и вставить точные значения в app.css".

#### Inter шрифт

Два варианта подключения:

**Вариант A (Google Fonts — рекомендуется для MVP):**

В src/app.html добавить в head:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

В src/app.css добавить:
```css
@layer base {
  html {
    font-family: "Inter", sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
}
```

**Вариант B (self-hosted — для Phase 4):**
```bash
npm install @fontsource/inter
```
Импортировать в +layout.svelte. Лучше для производительности, но усложняет старт.

---

### Decision 3: vite-plugin-pwa в SvelteKit

**Chosen approach:** @vite-pwa/sveltekit — специальный пакет для SvelteKit (не vite-plugin-pwa напрямую)

#### Установка

```bash
npm install -D @vite-pwa/sveltekit
```

**Важно:** Используется именно @vite-pwa/sveltekit, НЕ vite-plugin-pwa. Этот пакет знает о SvelteKit build pipeline и корректно обрабатывает .svelte-kit/output/.

#### vite.config.js (полная версия)

```javascript
import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ЭлектроЦентр — Помощник",
        short_name: "ЭлектроЦентр",
        description: "Подбор товаров электротехники в магазине ЭлектроЦентр",
        start_url: "/zalassist/",
        scope: "/zalassist/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2b7de0",
        lang: "ru",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["client/**/*.{js,css,ico,png,svg,webp,woff,woff2}"],
        navigateFallback: "/zalassist/",
        runtimeCaching: [
          {
            urlPattern: /\/catalog\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "catalog-cache",
              expiration: {
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ]
});
```

**Gotchas:**

1. **globPatterns с префиксом client/** — для SvelteKit adapter-static ассеты лежат в .svelte-kit/output/client/. Без префикса client/ можно случайно включить серверные файлы.

2. **start_url и scope** — должны включать base path /zalassist/. Без этого PWA не будет работать корректно на GitHub Pages.

3. **Иконки** — файлы pwa-192x192.png и pwa-512x512.png нужно положить в static/. Без них PWA не установится. Для MVP можно использовать простую иконку с буквой "Э" на синем фоне.

4. **registerType: "autoUpdate"** — автоматически обновляет Service Worker без промптов. Для MVP это правильно — клиент всегда получает актуальную версию.

5. **Phase 1 scope:** В Phase 1 Service Worker нужен ТОЛЬКО для PWA-installability (manifest + базовый SW). Полноценное кэширование (Cache-First, SWR) — это ARCH-04 из Phase 4. Однако runtimeCaching для catalog.json стоит добавить сразу, т.к. это DATA-02.

---

### Decision 4: QR-код с UTM-метками

**Chosen approach:** Онлайн-генерация статического QR + UTM-метки в URL

#### URL с UTM-метками

```
https://ikokolsk1y.github.io/zalassist/?utm_source=store&utm_medium=qr&utm_campaign=pilot_v1
```

**Параметры:**
- utm_source=store — трафик из физического магазина
- utm_medium=qr — канал — QR-код
- utm_campaign=pilot_v1 — пилотный запуск v1

#### Генерация QR-кода

**Рекомендация: использовать онлайн-генератор**, а не npm-библиотеку. Причина: QR-код нужен один раз для печати, нет смысла добавлять зависимость в проект.

**Генераторы (бесплатные, без watermark):**
- https://www.qrcode-monkey.com/ — SVG/PNG, кастомизация цветов, логотип
- https://goqr.me/ — простой, быстрый

**Характеристики QR:**
- Размер: минимум 3x3 см для печати
- Error correction: Level M (15%) — оптимально для печати
- Формат: SVG для масштабирования, PNG 1024x1024 для цифрового использования
- Цвет: синий #2b7de0 на белом фоне (фирменный)

**Альтернатива (если нужна генерация в коде):**
```bash
npx qrcode -o static/qr-code.png "https://ikokolsk1y.github.io/zalassist/?utm_source=store&utm_medium=qr&utm_campaign=pilot_v1"
```

Planner: QR-код — задача на конец фазы, после деплоя. Нет смысла генерировать до того, как URL реально работает.

---

### Decision 5: GitHub Actions workflow

**Chosen approach:** Современный workflow с actions/upload-pages-artifact + actions/deploy-pages

#### .github/workflows/deploy.yml

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "build"

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Настройка в GitHub:**
1. Settings -> Pages -> Source: **GitHub Actions** (не "Deploy from a branch")
2. Это критично — без этой настройки workflow не будет деплоить

**Gotchas:**
- concurrency.cancel-in-progress: false — не прерывать текущий деплой при новом push
- npm ci а не npm install — чистая установка из lockfile, быстрее и воспроизводимее
- node-version: 20 — LTS, совместим с SvelteKit 5
- path: "build" — должен совпадать с pages в adapter-static config

---

## Technology Notes

### SvelteKit 5 с adapter-static

**Версия:** SvelteKit 2.x с Svelte 5 (runes)

**Ключевые API:**
```javascript
// Svelte 5 runes syntax
let count = $state(0);
let doubled = $derived(count * 2);

$effect(() => {
  console.log("count changed:", count);
});
```

**Version-specific gotchas:**
- Svelte 5 использует runes ($state, $derived, $effect) вместо $: reactivity. Planner должен указать: ВСЕ компоненты пишем в Svelte 5 runes syntax.
- $app/paths — import base для всех ссылок внутри приложения.
- +layout.js (не .server.js) для prerender и trailingSlash при static adapter.

### Tailwind CSS v4

**Версия:** 4.x (CSS-first)

**Ключевые изменения от v3:**
- Нет tailwind.config.js — все в CSS через @import, @plugin, @theme
- Нет postcss.config.js — Tailwind работает как Vite-плагин
- Новый синтаксис: @theme { --color-brand: #2b7de0; } для кастомных значений
- @plugin "daisyui" вместо plugins: [require("daisyui")]

### DaisyUI 5

**Версия:** 5.x

**Ключевые изменения:**
- Цвета в формате OKLCH (не HSL как в v4)
- Темы определяются через @plugin "daisyui/theme" { ... } в CSS
- Компоненты: btn, card, chat, badge, input, navbar, bottom-navigation
- Chat bubble: chat chat-start / chat chat-end + chat-bubble — готово для Phase 3

### @vite-pwa/sveltekit

**Версия:** 0.6.x+

**Ключевые моменты:**
- Специфичный пакет для SvelteKit (не generic vite-plugin-pwa)
- Использует .svelte-kit/output/ для glob patterns
- Поддерживает static-adapter из коробки с версии 0.6.7
- globPatterns требует префикс client/

---

## Integration Points

### Inputs (from previous phases)

Нет — это стартовая фаза.

### Outputs (for Phase 2)

- **static/catalog.json** — Phase 2 будет использовать для индексации в MiniSearch
  - Формат: { lastUpdated: string, items: CatalogItem[] }
  - CatalogItem: { id, article, name, category, subcategory, brand, description, specs: Record<string, string>, inStock: boolean, unit: string }

- **src/lib/data/catalog.js** — Phase 2 импортирует для получения данных каталога
  - Должен экспортировать: export async function loadCatalog()
  - Должен экспортировать: export function getCatalogDate()

- **src/routes/+layout.svelte** — Phase 2 добавит навигацию/роутинг

- **src/app.css** — Phase 2 использует ту же тему и стили

- **Роутинг:** Phase 2 создаст src/routes/search/+page.svelte, должен работать с base path

---

## Pitfalls to Avoid

1. **Забыть {base} в ссылках** — Все href, src, fetch() внутри Svelte-компонентов ОБЯЗАНЫ использовать import { base } from "$app/paths". Без этого все работает в dev, ломается на GitHub Pages. **Fix:** Planner включает проверку base path в каждую задачу с UI.

2. **Забыть .nojekyll** — Без этого файла GitHub Pages запускает Jekyll, который игнорирует папки с _ (включая _app). **Fix:** Создать пустой static/.nojekyll в первой же задаче.

3. **Неправильный appDir** — Дефолтный _app может конфликтовать с Jekyll даже с .nojekyll в некоторых случаях. **Fix:** Установить appDir: "app" в svelte.config.js.

4. **OKLCH-цвета наугад** — DaisyUI 5 требует OKLCH-формат. Приблизительные значения дадут неправильные цвета. **Fix:** Обязательно конвертировать через https://oklch.com/ перед тем как вставлять в app.css.

5. **PWA иконки отсутствуют** — Без pwa-192x192.png и pwa-512x512.png в static/ PWA не пройдёт install criteria в Chrome. **Fix:** Создать минимальные иконки (даже placeholder) в первой задаче.

6. **GitHub Pages Source не переключён** — Деплой workflow будет молча завершаться без ошибки, но сайт не обновится, если Source в Settings -> Pages стоит на "Deploy from branch" вместо "GitHub Actions". **Fix:** Planner включает шаг настройки GitHub repo в план.

7. **npm ci без package-lock.json** — GitHub Actions workflow использует npm ci, который требует package-lock.json в репозитории. **Fix:** Коммитить package-lock.json (не добавлять в .gitignore).

8. **Inter шрифт через Google Fonts на мобильном** — Внешний запрос к fonts.googleapis.com может замедлить First Contentful Paint. **Fix:** Использовать display=swap в URL и рассмотреть self-hosting шрифта через @fontsource/inter для Phase 4. Для MVP — Google Fonts приемлемо.

9. **catalog.json в static/ vs fetched** — Файл в static/ будет включён в build output как есть. Для загрузки в runtime нужен fetch("${base}/catalog.json"), НЕ прямой import. **Fix:** Загружать через fetch в onMount или load function.

10. **Tailwind v4 + DaisyUI: порядок плагинов в vite.config.js** — tailwindcss() ОБЯЗАН быть перед sveltekit() в массиве plugins. Иначе стили не применятся. **Fix:** Зафиксировать порядок в шаблоне.

---

## Code Examples

### Стартовый экран (соответствует дизайн-системе из CONTEXT.md)

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import { base } from "$app/paths";
  import { Search, MessageSquare, Package } from "lucide-svelte";
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center px-4 pt-12 pb-8">
  <!-- Лого -->
  <div class="mb-8 text-center">
    <h1 class="text-2xl font-bold text-base-content">ЭлектроЦентр</h1>
    <p class="text-sm text-base-content/60 mt-1">Помощник в торговом зале</p>
  </div>

  <!-- Hero -->
  <h2 class="text-3xl font-bold text-base-content mb-6 text-center">
    Что будем делать?
  </h2>

  <!-- Поле ввода -->
  <div class="w-full max-w-md mb-8">
    <input
      type="text"
      placeholder="Артикул, название или задача..."
      class="input input-bordered input-lg w-full bg-base-100 shadow-md"
    />
  </div>

  <!-- 3 CTA -->
  <div class="w-full max-w-md flex flex-col gap-3">
    <a href="{base}/search" class="btn btn-primary btn-lg gap-2 min-h-[52px]">
      <Search size={20} />
      Найти товар
    </a>
    <a href="{base}/chat" class="btn btn-outline btn-lg gap-2 min-h-[52px]">
      <MessageSquare size={20} />
      Подобрать под задачу
    </a>
    <a href="{base}/kits" class="btn btn-outline btn-lg gap-2 min-h-[52px]">
      <Package size={20} />
      Готовые комплекты
    </a>
  </div>

  <!-- Suggestion chips -->
  <div class="flex flex-wrap gap-2 mt-8 justify-center max-w-md">
    {#each ["Автоматы", "Кабель", "Розетки", "Щиты", "Освещение"] as chip}
      <button class="badge badge-outline badge-lg py-3 px-4">{chip}</button>
    {/each}
  </div>

  <!-- Дата обновления каталога (UI-04) -->
  <p class="text-xs text-base-content/40 mt-auto pt-8">
    Каталог обновлён: 01.04.2026
  </p>
</div>
```

### Загрузка каталога

```javascript
// src/lib/data/catalog.js
import { base } from "$app/paths";

let catalogCache = null;

export async function loadCatalog() {
  if (catalogCache) return catalogCache;

  const response = await fetch(base + "/catalog.json");
  if (!response.ok) throw new Error("Failed to load catalog");

  catalogCache = await response.json();
  console.log("Catalog loaded: " + catalogCache.items.length + " items");
  return catalogCache;
}

export function getCatalogDate() {
  return catalogCache?.lastUpdated ?? "неизвестно";
}
```

### Формат catalog.json

```json
{
  "lastUpdated": "2026-04-01",
  "items": [
    {
      "id": 1,
      "article": "BA47-29-1P-16A",
      "name": "Автоматический выключатель ВА47-29 1P 16А 4,5кА С IEK",
      "category": "Автоматические выключатели",
      "subcategory": "Модульные автоматы",
      "brand": "IEK",
      "description": "Однополюсный автоматический выключатель для защиты цепей от перегрузок и коротких замыканий",
      "specs": {
        "Номинальный ток": "16А",
        "Число полюсов": "1P",
        "Характеристика": "С",
        "Отключающая способность": "4,5кА"
      },
      "inStock": true,
      "unit": "шт"
    }
  ]
}
```

### Root layout

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import "../app.css";
  let { children } = $props();
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#2b7de0" />
</svelte:head>

{@render children()}
```

### app.html шаблон

```html
<!doctype html>
<html lang="ru" data-theme="electrocentr">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

---

## Open Questions for Planner

1. **Lucide иконки — пакет для Svelte.** Рекомендация: lucide-svelte (официальный пакет). Установка: npm install lucide-svelte. Если пакет не совместим со Svelte 5 runes — fallback: использовать lucide-static (SVG strings) или SVG напрямую.

2. **PWA иконки — как создать.** Рекомендация: для MVP сгенерировать через https://favicon.io/ или https://realfavicongenerator.net/ простую иконку (буква "Э" на синем фоне #2b7de0). Нужны файлы: pwa-192x192.png, pwa-512x512.png, favicon.png. Включить задачу в план.

3. **Страницы-заглушки для /search, /chat, /kits.** Рекомендация: создать минимальные +page.svelte для этих роутов с текстом "Скоро здесь будет...". Без них кнопки на стартовом экране ведут на 404. Phase 2 и 3 заменят заглушки.

4. **Инициализация GitHub-репозитория.** Рекомендация: первая задача в плане — создание репозитория на GitHub через gh repo create ikokolsk1y/zalassist --public, первый push. Без репозитория на GitHub — Actions и Pages не работают.

5. **npm пакеты — полный список установки.** Команды для planner:

```bash
# Создание проекта
npx sv create zalassist
# (выбрать: SvelteKit minimal, TypeScript: No, ESLint: No, Prettier: No)

# Установка зависимостей
npm install tailwindcss@latest @tailwindcss/vite@latest daisyui@latest
npm install lucide-svelte
npm install -D @sveltejs/adapter-static @vite-pwa/sveltekit
```

**Примечание:** npx sv create создаёт проект SvelteKit 5. Это новая CLI-команда (заменила npm create svelte@latest). Если sv не доступна — fallback: npm create svelte@latest.
