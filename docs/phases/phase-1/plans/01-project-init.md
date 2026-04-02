---
phase: 1
plan: project-init
wave: 1
requires: []
req_ids:
  - ARCH-05
  - UI-02
status: pending
---

# Plan: Инициализация проекта SvelteKit

## Objective
Создать SvelteKit 5 проект с adapter-static, Tailwind CSS v4, DaisyUI 5, PWA-плагином и всеми конфигурационными файлами. После выполнения `npm run dev` запускается пустое приложение без ошибок.

## Context
- Проект greenfield — кода нет, только CLAUDE.md и docs/
- Стек: SvelteKit 5 + Vite 6 + Tailwind CSS v4 + DaisyUI 5 + @vite-pwa/sveltekit
- Base path: `/zalassist/` (для GitHub Pages под аккаунтом ikokolsk1y)
- Дизайн-система: Inter шрифт, фирменные цвета ЭлектроЦентр (синий #2b7de0, оранжевый #f15a2c)
- Svelte 5 runes syntax обязателен ($state, $derived, $effect)
- Прочитать: `c:/Users/ikoko/Projects/ZalAssist/docs/phases/phase-1/RESEARCH.md` — секции Decision 1-3

## Tasks

### Task 1: Создать SvelteKit проект
**What:** Инициализировать SvelteKit 5 проект в корне репозитория (не в подпапке).
**Where:** `c:/Users/ikoko/Projects/ZalAssist/`
**How:**
```bash
# Из корня проекта. Используем npx sv create для SvelteKit 5.
# Если sv недоступна — fallback: npm create svelte@latest
# Выбрать: SvelteKit minimal, TypeScript: No, ESLint: No, Prettier: No
# ВАЖНО: проект создаётся в текущей директории, не в подпапке.
# Если CLI создаёт подпапку — перенести содержимое в корень.
npx sv create . --template minimal --no-types --no-add
npm install
```
Если `sv create` не поддерживает флаги — использовать интерактивный режим или `npm create svelte@latest .`.
**Done when:** Файлы `package.json`, `svelte.config.js`, `vite.config.js`, `src/app.html`, `src/routes/+page.svelte` существуют в корне проекта. `npm run dev` запускается без ошибок.

### Task 2: Установить зависимости
**What:** Установить Tailwind CSS v4, DaisyUI 5, lucide-svelte, adapter-static и PWA-плагин.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/`
**How:**
```bash
npm install tailwindcss@latest @tailwindcss/vite@latest daisyui@latest lucide-svelte
npm install -D @sveltejs/adapter-static @vite-pwa/sveltekit
```
**Done when:** Все пакеты присутствуют в package.json (dependencies и devDependencies).

### Task 3: Настроить svelte.config.js
**What:** Заменить содержимое svelte.config.js на конфигурацию с adapter-static и base path.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/svelte.config.js`
**How:**
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
Критично: `appDir: "app"` (не `_app`), `base` пустой в dev-режиме, `/zalassist` в production.
**Done when:** `grep "adapter-static" svelte.config.js` находит строку. `grep "appDir" svelte.config.js` находит `"app"`.

### Task 4: Настроить vite.config.js
**What:** Настроить Vite с тремя плагинами: tailwindcss, sveltekit, SvelteKitPWA.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/vite.config.js`
**How:**
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
ВАЖНО: порядок плагинов — tailwindcss() ПЕРЕД sveltekit().
**Done when:** `grep "SvelteKitPWA" vite.config.js` находит строку. `grep "tailwindcss" vite.config.js` находит строку.

### Task 5: Создать src/app.css с темой ЭлектроЦентр
**What:** Создать CSS-файл с Tailwind v4 импортом, DaisyUI плагином и кастомной темой "electrocentr".
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/app.css`
**How:**
Содержимое — скопировать из RESEARCH.md, секция "src/app.css — Тема ЭлектроЦентр".
ОБЯЗАТЕЛЬНО: конвертировать hex-цвета в OKLCH через https://oklch.com/ и вставить точные значения:
- #2b7de0 -> primary
- #f15a2c -> secondary
- #1f2949 -> accent/neutral
- #f5f7fa -> base-200
- #e0e7f0 -> base-300

Добавить Inter шрифт в конце файла:
```css
@layer base {
  html {
    font-family: "Inter", sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
}
```
**Done when:** `grep "@plugin \"daisyui\"" src/app.css` находит строку. `grep "electrocentr" src/app.css` находит строку.

### Task 6: Создать src/app.html
**What:** HTML-шаблон с подключением Inter через Google Fonts и data-theme.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/src/app.html`
**How:**
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
**Done when:** `grep "electrocentr" src/app.html` находит строку. `grep "Inter" src/app.html` находит строку.

### Task 7: Создать layout файлы
**What:** Root layout с импортом CSS и layout.js с prerender-настройками.
**Where:**
- `c:/Users/ikoko/Projects/ZalAssist/src/routes/+layout.svelte`
- `c:/Users/ikoko/Projects/ZalAssist/src/routes/+layout.js`

**How:**

`src/routes/+layout.svelte`:
```svelte
<script>
  import "../app.css";
  let { children } = $props();
</script>

<svelte:head>
  <meta name="theme-color" content="#2b7de0" />
</svelte:head>

{@render children()}
```

`src/routes/+layout.js`:
```javascript
export const prerender = true;
export const trailingSlash = "always";
```
**Done when:** `grep "prerender" src/routes/+layout.js` находит `true`. `grep "app.css" src/routes/+layout.svelte` находит импорт.

### Task 8: Создать статические файлы
**What:** Создать .nojekyll, placeholder-иконки PWA и favicon.
**Where:**
- `c:/Users/ikoko/Projects/ZalAssist/static/.nojekyll` — пустой файл
- `c:/Users/ikoko/Projects/ZalAssist/static/pwa-192x192.png` — placeholder-иконка
- `c:/Users/ikoko/Projects/ZalAssist/static/pwa-512x512.png` — placeholder-иконка
- `c:/Users/ikoko/Projects/ZalAssist/static/favicon.png` — placeholder-иконка

**How:**
- `.nojekyll` — создать пустой файл `touch static/.nojekyll`
- PWA-иконки: сгенерировать минимальные PNG-иконки (синий #2b7de0 фон с белой буквой "Э"). Можно использовать canvas через Node.js скрипт или скачать с https://favicon.io/. Если генерация невозможна — создать placeholder-файлы (1x1 PNG) и оставить TODO-комментарий.
**Done when:** Файлы `static/.nojekyll`, `static/pwa-192x192.png`, `static/pwa-512x512.png`, `static/favicon.png` существуют.

### Task 9: Настроить .gitignore
**What:** Убедиться что .gitignore содержит правильные записи для SvelteKit.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/.gitignore`
**How:** Должен содержать как минимум:
```
node_modules/
build/
.svelte-kit/
.env
.env.*
!.env.example
.DS_Store
```
НЕ добавлять: `package-lock.json` (он нужен для npm ci в CI).
**Done when:** `grep "node_modules" .gitignore` находит строку. `grep ".svelte-kit" .gitignore` находит строку.

### Task 10: Проверить запуск
**What:** Запустить `npm run dev` и убедиться что приложение стартует без ошибок.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/`
**How:** `npm run dev -- --port 5173` — должен запуститься dev-сервер на порту 5173. Проверить что в консоли нет ошибок.
**Done when:** Dev-сервер стартует, в консоли нет ERROR. `npm run build` завершается с exit code 0.

## Tests Required
- `npm run build` завершается без ошибок (exit code 0)
- `npm run dev` стартует dev-сервер без ошибок
- В `build/` генерируется `index.html`

## Definition of Done
- [ ] SvelteKit 5 проект инициализирован в корне репозитория
- [ ] Все зависимости установлены (tailwind, daisyui, lucide-svelte, adapter-static, pwa)
- [ ] svelte.config.js настроен с adapter-static и base path /zalassist
- [ ] vite.config.js настроен с tailwindcss, sveltekit, SvelteKitPWA плагинами
- [ ] src/app.css содержит тему electrocentr с OKLCH-цветами
- [ ] src/app.html содержит Inter шрифт и data-theme="electrocentr"
- [ ] Layout файлы настроены с prerender и trailingSlash
- [ ] static/.nojekyll существует
- [ ] PWA-иконки (placeholder) существуют в static/
- [ ] `npm run build` завершается без ошибок
