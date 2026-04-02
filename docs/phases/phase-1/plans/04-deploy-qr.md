---
phase: 1
plan: deploy-qr
wave: 3
requires:
  - project-init
  - mock-catalog
  - home-screen
req_ids:
  - ARCH-05
  - UI-03
  - ANALYTICS-02
status: pending
---

# Plan: Деплой на GitHub Pages и QR-код

## Objective
Настроить GitHub Actions для автодеплоя на GitHub Pages при push в main, задеплоить приложение, убедиться что оно доступно по URL, сгенерировать QR-код с UTM-метками.

## Context
- Зависит от всех предыдущих планов — приложение должно собираться без ошибок
- Репозиторий: `ikokolsk1y/zalassist` на GitHub
- URL: `https://ikokolsk1y.github.io/zalassist/`
- GitHub Actions workflow из RESEARCH.md (Decision 5): actions/upload-pages-artifact + actions/deploy-pages
- ВАЖНО: В настройках GitHub репозитория Settings -> Pages -> Source нужно выбрать "GitHub Actions" (не "Deploy from a branch")
- QR-код с UTM: `?utm_source=store&utm_medium=qr&utm_campaign=pilot_v1`
- Прочитать: `c:/Users/ikoko/Projects/ZalAssist/docs/phases/phase-1/RESEARCH.md` — секции Decision 4, Decision 5

## Tasks

### Task 1: Создать GitHub Actions workflow
**What:** YAML-файл для автодеплоя на GitHub Pages при push в main.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/.github/workflows/deploy.yml`
**How:**
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
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Критичные моменты:
- `path: "build"` — совпадает с adapter-static output
- `npm ci` (не `npm install`) — чистая установка из lockfile
- `node-version: 20` — LTS
- `cancel-in-progress: false` — не прерывать текущий деплой

**Done when:** Файл `.github/workflows/deploy.yml` существует. `grep "deploy-pages@v4" .github/workflows/deploy.yml` находит строку.

### Task 2: Создать/настроить GitHub-репозиторий
**What:** Убедиться что репозиторий `ikokolsk1y/zalassist` существует на GitHub, настроить GitHub Pages source.
**Where:** GitHub
**How:**
1. Проверить наличие удалённого репозитория:
```bash
gh repo view ikokolsk1y/zalassist 2>/dev/null || gh repo create ikokolsk1y/zalassist --public --source=. --push
```
2. Настроить GitHub Pages source на "GitHub Actions":
```bash
gh api repos/ikokolsk1y/zalassist/pages -X PUT -f build_type="workflow" 2>/dev/null || gh api repos/ikokolsk1y/zalassist/pages -X POST -f build_type="workflow" -f source='{"branch":"main","path":"/"}'
```
Если команда API не работает — оставить TODO с инструкцией: "Settings -> Pages -> Source -> GitHub Actions".

3. Убедиться что remote origin настроен:
```bash
git remote get-url origin || git remote add origin https://github.com/ikokolsk1y/zalassist.git
```

**Done when:** `git remote get-url origin` возвращает URL репозитория. Репозиторий существует на GitHub.

### Task 3: Первый деплой
**What:** Закоммитить все файлы Phase 1, push в main, дождаться деплоя.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/`
**How:**
```bash
git add -A
git commit -m "Phase 1: фундамент и деплой — SvelteKit + каталог + стартовый экран"
git push -u origin main
```

Дождаться завершения GitHub Actions:
```bash
gh run list --limit 1
# Когда run завершится:
gh run view --log-failed  # если есть ошибки
```

**Done when:** `gh run list --limit 1` показывает статус "completed" и conclusion "success".

### Task 4: Проверить деплой
**What:** Убедиться что приложение доступно по URL и корректно отображается.
**Where:** Браузер / curl
**How:**
```bash
curl -s -o /dev/null -w "%{http_code}" https://ikokolsk1y.github.io/zalassist/
# Ожидаемый результат: 200

curl -s https://ikokolsk1y.github.io/zalassist/ | grep -o "ЭлектроЦентр"
# Ожидаемый результат: ЭлектроЦентр

curl -s -o /dev/null -w "%{http_code}" https://ikokolsk1y.github.io/zalassist/catalog.json
# Ожидаемый результат: 200
```

Проверить на мобильном: открыть URL в Safari (iOS) и Chrome (Android). Стартовый экран должен отображаться с 3 кнопками.

**Done when:** curl возвращает HTTP 200 для главной страницы и catalog.json. На странице присутствует текст "ЭлектроЦентр".

### Task 5: Сгенерировать QR-код с UTM
**What:** Создать QR-код для URL с UTM-метками.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/static/qr-code.png` (для хранения в репозитории)
**How:**
URL для QR:
```
https://ikokolsk1y.github.io/zalassist/?utm_source=store&utm_medium=qr&utm_campaign=pilot_v1
```

Способ генерации (выбрать один):
1. **npx (рекомендуется):**
```bash
npx qrcode -o static/qr-code.png "https://ikokolsk1y.github.io/zalassist/?utm_source=store&utm_medium=qr&utm_campaign=pilot_v1"
```
2. **Онлайн-генератор:** https://www.qrcode-monkey.com/ — скачать PNG 1024x1024, сохранить как static/qr-code.png

Характеристики:
- Размер: минимум 1024x1024px (достаточно для печати 3x3 см при 300dpi)
- Error correction: Level M
- Формат: PNG

**Done when:** Файл `static/qr-code.png` существует. QR-код при сканировании ведёт на URL с UTM-метками.

### Task 6: Обновить деплой с QR-кодом
**What:** Закоммитить QR-код и обновить деплой.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/`
**How:**
```bash
git add static/qr-code.png
git commit -m "Добавлен QR-код с UTM-метками для пилота"
git push
```
**Done when:** QR-код доступен по URL `https://ikokolsk1y.github.io/zalassist/qr-code.png`.

## Tests Required
- GitHub Actions workflow завершается без ошибок (build + deploy jobs)
- `curl https://ikokolsk1y.github.io/zalassist/` возвращает HTTP 200
- `curl https://ikokolsk1y.github.io/zalassist/catalog.json` возвращает HTTP 200
- QR-код при сканировании открывает приложение в мобильном браузере
- URL после сканирования QR содержит UTM-параметры

## Definition of Done
- [ ] `.github/workflows/deploy.yml` настроен и работает
- [ ] GitHub Pages source = "GitHub Actions"
- [ ] Приложение доступно по `https://ikokolsk1y.github.io/zalassist/`
- [ ] Стартовый экран с 3 кнопками отображается при открытии URL
- [ ] catalog.json доступен по URL и возвращает HTTP 200
- [ ] QR-код с UTM-метками сгенерирован и сохранён в репозитории
- [ ] QR-код при сканировании ведёт на приложение с UTM-параметрами
