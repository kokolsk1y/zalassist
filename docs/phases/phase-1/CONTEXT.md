# Phase 1 Context

**Phase:** 1 — Фундамент и деплой
**Discussion date:** 2026-04-01
**Status:** ready-to-plan

## Decisions

### Имя репозитория и URL
**Decision:** Репозиторий `zalassist`, аккаунт `ikokolsk1y`
**Rationale:** Короткое имя, легко запомнить, подходит для QR-кода
**Implications:**
- URL: `https://ikokolsk1y.github.io/zalassist/`
- Base path в Vite/SvelteKit: `/zalassist/`
- QR-код генерируется на этот URL с UTM-метками

### Каталог: мок-данные на старте
**Decision:** Начинаем с мок-данных (50-100 товаров электротехники), реальную выгрузку из 1С подставим позже
**Rationale:** Не блокировать разработку внешней зависимостью. Формат конвертера подстроим под реальную выгрузку когда она придёт
**Implications:**
- Нужен генератор мок-данных с реалистичными артикулами, названиями, категориями
- Формат catalog.json проектируем сейчас, но он может измениться
- Минимальные поля: id, article, name, category, brand, description, specs, inStock

### Фреймворк: SvelteKit + adapter-static
**Decision:** SvelteKit (не чистый Svelte), деплой через adapter-static на GitHub Pages
**Rationale:** При расширении проекта миграция с чистого Svelte на SvelteKit = переписывание. SvelteKit даёт роутинг, SSR-ready, API routes из коробки. Дополнительная сложность на старте минимальна.
**Implications:**
- `@sveltejs/adapter-static` с `base: '/zalassist'`
- Файловый роутинг: `/search`, `/chat`, `/kits`
- В V2 можно добавить серверную часть без смены фреймворка

### UI: стиль и дизайн-система
**Decision:** Эстетичный мобильный UI в стиле Perplexity + Lowe's Mylow, фирменные цвета ЭлектроЦентр
**Rationale:** Пользователь явно просил "красиво и эстетично", ссылаясь на успешные продукты. Исследование UI подтвердило паттерны.
**Implications:**

**Палитра:**
- Primary: `#2b7de0` (синий)
- Primary hover: `#468de4`
- Primary dark: `#1f2949` (тёмно-синий, текст)
- Accent/CTA: `#f15a2c` (оранжевый) — только на кнопках Send и "В список"
- Surface: `#f5f7fa`
- Border: `#e0e7f0`
- White: `#ffffff`

**Дизайн-система:**
- Шрифт: Inter (Google Fonts, отличная кириллица)
- Иконки: Lucide Icons (stroke, 1.5px)
- Border-radius: 12px карточки, 18px пузыри чата, pill для chips
- Тени: 3 уровня (card, hover, float)
- Spacing: шаг 4px (4, 8, 12, 16, 20, 24, 32, 40)
- Tap target: минимум 44x44px
- Анимации: bubble-in (пружинная), skeleton shimmer

**Стартовый экран:** Perplexity-стиль
- Лого/название ЭлектроЦентр сверху
- Hero-текст "Что будем делать?"
- Большое поле ввода
- Suggestion chips (категории электротехники)
- 3 CTA: Найти товар (primary), Подобрать под задачу, Готовые комплекты

**Чат:** Klarna + Sephora стиль
- Карточки товаров прямо в чате (как Lowe's Mylow)
- Quick-reply chips после каждого ответа
- Typing indicator (3 точки с анимацией)
- Стриминг посимвольно

**Референсы из IKEA/Leroy Merlin:**
- Сопутствующие товары при поиске (Leroy Merlin)
- Готовые комплекты как "комната целиком" (IKEA)
- Список для консультанта (аналог IKEA shopping list)

## Canonical References

| Reference | File path | Notes |
|-----------|-----------|-------|
| Каталог товаров | static/catalog.json | Формат определяется в этой фазе |
| Дизайн-токены | Будет создан | CSS custom properties |
| Research | docs/RESEARCH.md | Архитектура, стек, паттерны |
| UI Research | Результаты агента gsd-ui-researcher | Perplexity, Klarna, Lowe's паттерны |
| Market Data | docs/market-data.md | Цифры для презентации руководству |

## Code Insights

Проект чистый — кода нет. Greenfield. Всё создаётся с нуля.

Стек зафиксирован:
- SvelteKit 5 + Vite 6
- Tailwind CSS v4 + DaisyUI 5
- vite-plugin-pwa 0.21
- MiniSearch 7
- Inter (шрифт) + Lucide (иконки)
- adapter-static для GitHub Pages

## Deferred Ideas

- QR-код на каждом экспонате товара → сканирование = карточка товара — deferred to Phase 2+
- Сопутствующие товары ("что ещё нужно") — deferred to Phase 2 (поиск)
- Тёмная тема — deferred to V2
- Голосовой ввод — deferred to V2
- Баннер "Добавить на главный экран" — deferred to Phase 4
