'use strict';

/**
 * Конвертер каталога из CSV (выгрузка 1С) в JSON.
 *
 * Использование:
 *   node scripts/convert-catalog.js <path/to/export.csv> [--out <path/to/output.json>]
 *
 * Если --out не указан — результат печатается в stdout.
 * CSV ожидается с разделителем ";" в кодировке UTF-8.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Маппинг колонок CSV → поля JSON ────────────────────────────────────────
// Измени значения здесь, если заголовки в выгрузке 1С отличаются.

const COLUMN_MAP = {
  article:     'Артикул',
  name:        'Наименование',
  category:    'Категория',
  subcategory: 'Подкатегория',
  brand:       'Бренд',
  description: 'Описание',
  unit:        'Единица',
  inStock:     'Наличие',
};

// Разделитель CSV
const CSV_DELIMITER = ';';

// ─── Вспомогательные функции ─────────────────────────────────────────────────

/**
 * Парсит строку значения "Наличие" в boolean.
 * ДА / да / 1 / true / yes → true, остальное → false.
 */
function parseInStock(value) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === 'да' || v === '1' || v === 'true' || v === 'yes';
}

/**
 * Разбирает строку CSV с учётом кавычек.
 * Поддерживает кавычки только в простом варианте (без экранирования внутри).
 */
function parseCSVLine(line, delimiter) {
  const result = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(field.trim());
      field = '';
    } else {
      field += ch;
    }
  }
  result.push(field.trim());
  return result;
}

// ─── Аргументы командной строки ──────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2); // убираем node + script
  let csvPath = null;
  let outPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outPath = args[++i];
    } else if (!args[i].startsWith('--') && !csvPath) {
      csvPath = args[i];
    }
  }

  return { csvPath, outPath };
}

// ─── Основная логика ─────────────────────────────────────────────────────────

async function convert(csvPath, outPath) {
  if (!csvPath) {
    console.error('Ошибка: укажите путь к CSV-файлу.');
    console.error('Использование: node convert-catalog.js <file.csv> [--out output.json]');
    process.exit(1);
  }

  const resolvedCsv = path.resolve(csvPath);

  if (!fs.existsSync(resolvedCsv)) {
    console.error(`Ошибка: файл не найден: ${resolvedCsv}`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(resolvedCsv, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  const items = [];
  let headerIndexes = null;  // { fieldName: columnIndex }
  let lineNumber = 0;
  let skippedCount = 0;

  for await (const line of rl) {
    lineNumber++;
    const trimmed = line.trim();
    if (!trimmed) continue;  // пропуск пустых строк

    const cols = parseCSVLine(trimmed, CSV_DELIMITER);

    // Первая строка — заголовки
    if (lineNumber === 1) {
      headerIndexes = {};
      for (const [field, csvHeader] of Object.entries(COLUMN_MAP)) {
        const idx = cols.findIndex(
          (h) => h.trim().toLowerCase() === csvHeader.toLowerCase()
        );
        headerIndexes[field] = idx; // -1 если не найдено
      }

      // Предупреждение о ненайденных столбцах
      for (const [field, idx] of Object.entries(headerIndexes)) {
        if (idx === -1) {
          process.stderr.write(
            `Предупреждение: столбец "${COLUMN_MAP[field]}" (${field}) не найден в CSV.\n`
          );
        }
      }
      continue;
    }

    // Получаем значение поля по индексу
    const get = (field) => {
      const idx = headerIndexes[field];
      return idx >= 0 && idx < cols.length ? cols[idx] : '';
    };

    const article = get('article');

    // Пропускаем строки без артикула
    if (!article) {
      skippedCount++;
      continue;
    }

    items.push({
      article,
      name:        get('name')        || '',
      category:    get('category')    || '',
      subcategory: get('subcategory') || '',
      brand:       get('brand')       || '',
      description: get('description') || '',
      unit:        get('unit')        || 'шт',
      inStock:     parseInStock(get('inStock')),
    });
  }

  const result = {
    lastUpdated: new Date().toISOString().slice(0, 10),
    items,
  };

  const json = JSON.stringify(result, null, 2);

  if (outPath) {
    const resolvedOut = path.resolve(outPath);
    const outDir = path.dirname(resolvedOut);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(resolvedOut, json, 'utf-8');
    process.stderr.write(`Записано: ${resolvedOut}\n`);
  } else {
    process.stdout.write(json + '\n');
  }

  process.stderr.write(
    `Обработано: ${items.length} позиций, пропущено без артикула: ${skippedCount}\n`
  );
}

// ─── Запуск ──────────────────────────────────────────────────────────────────

const { csvPath, outPath } = parseArgs(process.argv);
convert(csvPath, outPath).catch((err) => {
  console.error('Непредвиденная ошибка:', err.message);
  process.exit(1);
});
