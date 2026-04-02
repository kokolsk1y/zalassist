---
phase: 1
plan: mock-catalog
wave: 1
requires: []
req_ids:
  - DATA-01
  - DATA-02
status: pending
---

# Plan: Мок-каталог и конвертер

## Objective
Создать генератор мок-данных электротехники (50-100 товаров), скрипт конвертации CSV->JSON и итоговый catalog.json с реалистичными артикулами, названиями и категориями.

## Context
- Формат catalog.json определён в RESEARCH.md: `{ lastUpdated: string, items: CatalogItem[] }`
- CatalogItem: `{ id, article, name, category, subcategory, brand, description, specs: Record<string,string>, inStock: boolean, unit: string }`
- Начинаем с мок-данных — реальная выгрузка из 1С будет позже
- Мок-данные должны быть реалистичными: настоящие артикулы IEK, ABB, EKF; настоящие категории электротехники
- Конвертер convert-catalog.js — для будущей работы с реальной выгрузкой
- Прочитать: `c:/Users/ikoko/Projects/ZalAssist/docs/phases/phase-1/RESEARCH.md` — секция "Формат catalog.json"

## Tasks

### Task 1: Создать генератор мок-каталога
**What:** Node.js скрипт, генерирующий catalog.json с 80 реалистичными товарами электротехники.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/scripts/generate-mock-catalog.js`
**How:**
Скрипт должен:
1. Содержать массивы реалистичных данных:
   - **Категории** (минимум 8): Автоматические выключатели, УЗО, АВДТ (дифавтоматы), Кабель и провод, Розетки и выключатели, Щиты и боксы, Освещение, Кабельные каналы
   - **Бренды**: IEK, ABB, EKF, Schneider Electric, Legrand, TDM
   - **Артикулы**: реалистичный формат, например `BA47-29-1P-16A-IEK`, `AVDT32-C16-30MA-IEK`, `VVGng-3x2.5`
   - **Specs**: реальные характеристики (номинальный ток, число полюсов, сечение, IP-защита и т.д.)
2. Генерировать 80 уникальных товаров
3. Записывать результат в `static/catalog.json`
4. Формат:
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
5. Запуск: `node scripts/generate-mock-catalog.js`
6. Вывод в консоль: количество сгенерированных товаров

Важно: товары должны быть разнообразными по категориям — не только автоматы. Включить кабели (unit: "м"), щиты, розетки, освещение.

**Done when:** Файл `static/catalog.json` содержит 80+ записей. `node -e "const c = require('./static/catalog.json'); console.log(c.items.length)"` выводит число >= 80.

### Task 2: Создать конвертер CSV -> JSON
**What:** Node.js скрипт для конвертации CSV-выгрузки из 1С в catalog.json.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/scripts/convert-catalog.js`
**How:**
Скрипт должен:
1. Принимать путь к CSV-файлу как аргумент: `node scripts/convert-catalog.js data/export.csv`
2. Читать CSV с разделителем `;` (стандарт 1С)
3. Ожидаемые колонки CSV (маппинг настраивается в начале файла):
   - Артикул -> article
   - Наименование -> name
   - Категория -> category
   - Подкатегория -> subcategory (опционально)
   - Бренд -> brand
   - Описание -> description (опционально)
   - Единица измерения -> unit
   - Наличие -> inStock (ДА/НЕТ -> true/false)
4. Нормализовать поля:
   - Убрать лишние пробелы (trim)
   - article: оставить как есть (нормализация при поиске — задача Phase 2)
   - inStock: "ДА", "Да", "да", "1", "true" -> true, остальное -> false
5. Записывать результат в `static/catalog.json`
6. Вывод: количество обработанных строк, количество пропущенных (без артикула)
7. НЕ использовать внешние npm-зависимости — только встроенные модули Node.js (fs, path, readline)

**Done when:** `grep "readline" scripts/convert-catalog.js` находит строку. Скрипт запускается без ошибок при передаче несуществующего файла (показывает понятную ошибку).

### Task 3: Создать пример CSV для тестирования конвертера
**What:** Небольшой CSV-файл (5-10 строк) для проверки работы convert-catalog.js.
**Where:** `c:/Users/ikoko/Projects/ZalAssist/scripts/sample-data/sample-export.csv`
**How:**
```csv
Артикул;Наименование;Категория;Подкатегория;Бренд;Описание;Единица;Наличие
BA47-29-1P-16A;Автомат ВА47-29 1P 16А IEK;Автоматы;Модульные;IEK;Однополюсный автомат;шт;ДА
VVGng-3x2.5;Кабель ВВГнг 3x2.5;Кабель;Силовой;Россия;Медный кабель;м;ДА
```
Минимум 5 строк с разными категориями. Включить одну строку без артикула (для теста пропуска).
**Done when:** Файл `scripts/sample-data/sample-export.csv` существует и содержит 5+ строк данных.

## Tests Required
- `node scripts/generate-mock-catalog.js` завершается без ошибок, создаёт `static/catalog.json`
- `static/catalog.json` парсится как валидный JSON
- Каждый item имеет обязательные поля: id, article, name, category, brand, inStock, unit
- `node scripts/convert-catalog.js scripts/sample-data/sample-export.csv` завершается без ошибок

## Definition of Done
- [ ] `scripts/generate-mock-catalog.js` генерирует 80+ реалистичных товаров
- [ ] `static/catalog.json` содержит валидный JSON с полем `lastUpdated` и массивом `items`
- [ ] `scripts/convert-catalog.js` конвертирует CSV в JSON формат catalog.json
- [ ] Конвертер обрабатывает разделитель `;`, нормализует inStock, пропускает строки без артикула
- [ ] Пример CSV-файла существует для тестирования
