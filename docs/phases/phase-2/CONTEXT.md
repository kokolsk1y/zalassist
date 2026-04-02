# Phase 2 Context

**Phase:** 2 — Поиск по каталогу
**Discussion date:** 2026-04-02
**Status:** ready-to-plan

## Decisions

### Поведение поля ввода на главной
**Decision:** Ввод на главной → редирект на `/search/?q=текст`. Chips ведут на `/search/?category=Автоматы`. Главная остаётся лендингом.
**Rationale:** Главная — чистая точка входа, /search — полноценная страница с результатами и фильтрами. Проще в реализации, понятнее для пользователя.
**Implications:**
- Стартовый экран (+page.svelte): добавить обработчик Enter на input → `goto(base + '/search/?q=' + query)`
- Chips: обернуть в `<a href="{base}/search/?category={chip}">`
- /search: читать query params из URL при загрузке

### Карточка товара — bottom sheet
**Decision:** Компактные карточки в списке результатов, при клике — bottom sheet (модальное окно снизу) с полной информацией.
**Rationale:** Привычный мобильный паттерн. Не нужен роутинг для каждого товара, пользователь остаётся в контексте поиска. Всё работает мгновенно — данные уже в памяти.
**Implications:**
- Компонент ProductCard: артикул, название, бренд, наличие
- Компонент ProductSheet: bottom sheet с полным описанием, specs, кнопка "В список"
- Без отдельных страниц /product/[id]

### Кнопка "Показать менеджеру"
**Decision:** Экран с крупным списком артикулов (читается консультантом с телефона клиента) + кнопка "Скопировать" в буфер обмена.
**Rationale:** Консультанту удобнее читать с экрана (крупный шрифт), B2B-клиент может скопировать и отправить на почту/в чат.
**Implications:**
- Нужен "список покупок" — state с выбранными товарами (артикул + название + количество)
- Кнопка "В список" на каждой карточке и в bottom sheet
- Отдельная страница или модалка "/list" с крупным шрифтом
- navigator.clipboard.writeText() для копирования
- Счётчик товаров в списке виден в навигации

## Canonical References

| Reference | File path | Notes |
|-----------|-----------|-------|
| Каталог (загрузка) | src/lib/data/catalog.js | loadCatalog(), getCatalogDate() — уже существует |
| Каталог (данные) | static/catalog.json | 74 товара, 8 категорий |
| Стартовый экран | src/routes/+page.svelte | Добавить обработчики ввода и chips |
| Заглушка поиска | src/routes/search/+page.svelte | Заменить на полноценный поиск |
| Тема | src/app.css | DaisyUI electrocentr, не менять |
| Layout | src/routes/+layout.svelte | Может потребоваться bottom nav |

## Code Insights

- `src/lib/data/catalog.js` — загрузка с кэшированием, экспортирует loadCatalog() и getCatalogDate()
- Каталог: `{ lastUpdated, items: [{ id, article, name, category, subcategory, brand, description, specs, inStock, unit }] }`
- Все ссылки через `import { base } from "$app/paths"` — обязательно
- Svelte 5 runes: $state, $derived, $effect, $props
- DaisyUI компоненты: card, badge, modal, bottom-navigation, input
- Lucide-svelte для иконок

## Deferred Ideas

- Голосовой ввод (Web Speech API) — deferred to V2
- Фильтры по бренду, цене — deferred to V2 (пока только категории и текстовый поиск)
- Сопутствующие товары ("что ещё нужно") — deferred to V2
- История поиска — deferred to V2
