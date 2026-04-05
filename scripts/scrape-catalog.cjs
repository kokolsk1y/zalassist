'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Конфигурация безопасности ─────────────────────────────────────────────
const CONFIG = {
  baseUrl: 'https://stv39.ru',
  itemsPerPage: 100,
  delayMs: 1500,          // Задержка между запросами (мс)
  maxResponseTime: 5000,  // Если ответ > 5 сек — увеличиваем задержку
  pauseDelayMs: 5000,     // Задержка после медленного ответа
  maxRetries: 3,          // Макс. попыток на запрос
  retryDelayMs: 3000,     // Задержка перед повтором
  requestTimeout: 15000,  // Таймаут запроса (мс)
  userAgent: 'ZalAssist-Catalog-Sync/1.0 (internal tool; stv39.ru)',
};

// 13 категорий верхнего уровня — каждая показывает ВСЕ товары из подкатегорий
const TOP_CATEGORIES = [
  { slug: 'avtomatika_i_shchity', name: 'Автоматика и Щиты' },
  { slug: 'kabel_i_provod', name: 'Кабель и провод' },
  { slug: 'lampy', name: 'Лампы' },
  { slug: 'osvetitelnoe_oborudovanie', name: 'Осветительное оборудование' },
  { slug: 'izmeritelnye_i_lazernye_pribory_elementy_pitaniya', name: 'Измерительные приборы' },
  { slug: 'rozetki_vyklyuchateli_troyniki_korobki_razemy_i_udliniteli', name: 'Розетки и выключатели' },
  { slug: 'instrument_ruchnoy', name: 'Инструмент ручной' },
  { slug: 'instrument_akkumulyatornyy_svarochnyy_pnevmo_elektro_i_benzo', name: 'Электроинструмент' },
  { slug: 'klimat_kontrol_ventilyatsiya_i_obogrev', name: 'Климат-контроль' },
  { slug: 'bytovye_i_sadovye_tovary', name: 'Бытовые и садовые товары' },
  { slug: 'elektromontazh_truby_kabel_kanal_lotki_i_krepleniya', name: 'Электромонтаж' },
  { slug: 'stroitelnoe_oborudovanie_i_materialy', name: 'Строительное оборудование' },
  { slug: 'tovary_dlya_avtomobilya', name: 'Товары для автомобиля' },
];

// ─── HTTP-запрос с таймаутом и замером времени ─────────────────────────────
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const req = https.get(url, {
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'text/html',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      },
      timeout: CONFIG.requestTimeout,
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        const html = Buffer.concat(chunks).toString('utf-8');
        resolve({ html, elapsed });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout for ${url}`));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Запрос с ретраями и адаптивной задержкой ──────────────────────────────
async function safeFetch(url, stats) {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const { html, elapsed } = await fetchPage(url);
      stats.totalRequests++;
      stats.totalTime += elapsed;

      if (elapsed > CONFIG.maxResponseTime) {
        console.log(`  ⚠ Медленный ответ (${elapsed}мс) — пауза ${CONFIG.pauseDelayMs}мс`);
        stats.slowResponses++;
        await sleep(CONFIG.pauseDelayMs);
      } else {
        await sleep(CONFIG.delayMs);
      }

      return html;
    } catch (err) {
      console.log(`  ✗ Попытка ${attempt}/${CONFIG.maxRetries}: ${err.message}`);
      if (attempt < CONFIG.maxRetries) {
        await sleep(CONFIG.retryDelayMs * attempt);
      } else {
        stats.errors++;
        return null;
      }
    }
  }
}

// ─── Декодирование HTML-entities ──────────────────────────────────────────
function decodeEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

// ─── Парсинг товаров из HTML ───────────────────────────────────────────────
function parseProducts(html, categoryName) {
  const productDataMap = new Map();

  // 1. JCCatalogSection JSON-блоки — основной источник данных
  const jsRe = /JCCatalogSection\((\{.*?\})\)/g;
  let jsMatch;
  while ((jsMatch = jsRe.exec(html)) !== null) {
    try {
      const jsonStr = jsMatch[1].replace(/'/g, '"');
      const data = JSON.parse(jsonStr);
      const p = data.PRODUCT;
      if (!p || !p.ID) continue;

      const entry = {
        id: parseInt(p.ID),
        name: decodeEntities((p.NAME || '').trim()),
        photo: p.PICT ? CONFIG.baseUrl + p.PICT.SRC : null,
        canBuy: p.CAN_BUY || false,
        quantity: parseFloat(p.MAX_QUANTITY) || 0,
        price: 0,
        oldPrice: null,
        article: '',
        category: categoryName,
      };

      if (p.BASIS_PRICE) {
        const bp = p.BASIS_PRICE;
        entry.price = parseFloat(bp.DISCOUNT_VALUE) || parseFloat(bp.VALUE) || 0;
        const orig = parseFloat(bp.VALUE);
        const disc = parseFloat(bp.DISCOUNT_VALUE);
        if (orig && disc && orig > disc) {
          entry.oldPrice = orig;
        }
      }

      productDataMap.set(p.ID, entry);
    } catch (e) {
      // Пропускаем битый JSON
    }
  }

  // 2. Артикулы — последовательный fallback
  const artRe = /prod__art[^"]*">\s*Арт\.\s*([^<]+)/g;
  const articles = [];
  let artMatch;
  while ((artMatch = artRe.exec(html)) !== null) {
    const art = artMatch[1].trim();
    if (!articles.includes(art)) articles.push(art);
  }

  const ids = [...productDataMap.keys()];
  for (let i = 0; i < ids.length && i < articles.length; i++) {
    productDataMap.get(ids[i]).article = articles[i];
  }

  // 3. Единицы измерения
  const unitRe = /quant__measure[^>]*>\s*([^<]+)/g;
  const units = [];
  let unitMatch;
  while ((unitMatch = unitRe.exec(html)) !== null) {
    const u = unitMatch[1].trim();
    if (u && !units.includes(u)) units.push(u);
  }
  // Если все товары в одной единице — применяем ко всем
  if (units.length === 1) {
    for (const entry of productDataMap.values()) {
      entry.unit = units[0];
    }
  }

  return [...productDataMap.values()];
}

// ─── Определение числа страниц ─────────────────────────────────────────────
function getMaxPage(html) {
  const re = /PAGEN_1=(\d+)/g;
  let max = 1;
  let m;
  while ((m = re.exec(html)) !== null) {
    max = Math.max(max, parseInt(m[1]));
  }
  return max;
}

// ─── Сканирование одной категории (все страницы) ───────────────────────────
async function scrapeCategory(cat, stats) {
  const url = `${CONFIG.baseUrl}/catalog/${cat.slug}/?count=${CONFIG.itemsPerPage}`;
  const html = await safeFetch(url, stats);
  if (!html) return [];

  const products = parseProducts(html, cat.name);
  const maxPage = getMaxPage(html);

  console.log(`  Стр. 1/${maxPage}: ${products.length} товаров`);

  for (let page = 2; page <= maxPage; page++) {
    const pageUrl = `${CONFIG.baseUrl}/catalog/${cat.slug}/?count=${CONFIG.itemsPerPage}&PAGEN_1=${page}`;
    const pageHtml = await safeFetch(pageUrl, stats);
    if (!pageHtml) continue;

    const pageProducts = parseProducts(pageHtml, cat.name);
    products.push(...pageProducts);
    console.log(`  Стр. ${page}/${maxPage}: +${pageProducts.length} (всего ${products.length})`);
  }

  return products;
}

// ─── Извлечение бренда из названия ──────────────────────────────────────────
const KNOWN_BRANDS = [
  // Длинные имена первыми (чтобы "Schneider Electric" не перехватился как "Electric")
  'Schneider Electric', 'EKF AVERES', 'EKF PROXIMA', 'IN HOME',
  // Автоматика и щиты
  'IEK', 'ИЕК', 'ИЭК', 'ABB', 'Legrand', 'TDM', 'Eaton', 'CHINT', 'EKF',
  'ETI', 'GENERICA', 'ONI', 'DEKraft', 'КЭАЗ', 'DKC',
  'WAGO', 'BALS', 'Emas', 'MEYERTEC', 'Meyertec', 'FINDER',
  // Кабель и электромонтаж
  'REXANT', 'RIPO', 'PROCONNECT', 'TEHPLAST', 'Ecoplast',
  'Промрукав', 'ELEKTROPLAST', 'KRANZ', 'RocketSocket',
  // Розетки и выключатели
  'Bironi', 'Livolo', 'OVIVO', 'Bylectrica', 'STEKKER', 'WERKEL', 'Werkel',
  'Ritter', 'UNIVersal',
  // Освещение
  'Gauss', 'Feron', 'Navigator', 'Osram', 'Philips', 'LEDURO',
  'LEEK', 'Leek', 'WOLTA', 'Uniel', 'Jazzway', 'ERGOLUX', 'Ergolux',
  'Ultraflash', 'Ledline', 'SWG', 'ASD', 'GTV', 'KODAK', 'Kodak',
  // Инструмент
  'HOEGERT', 'Makita', 'Bosch', 'DeWalt', 'Metabo', 'Hilti',
  'Stanley', 'MATRIX', 'KNIPEX', 'WERA', 'Haupa', 'TOPEX',
  'CHAMPION', 'WORKPRO', 'FELO', 'AEG', 'STABILA', 'Armero',
  'VERTO', 'KOELNER', 'HONITON',
  // Измерительные приборы
  'CONDTROL', 'CEM', 'MASTECH', 'NITECORE',
  // Климат и обогрев
  'Thermor', 'AURAMAX',
  // Бытовые и садовые
  'Gardena', 'Husqvarna', 'STIHL', 'KARCHER',
  // Электропитание и стабилизаторы
  'RUCELF', 'Ресанта', 'SVEN', 'ВИХРЬ',
  // Общие
  'Зубр', 'PATRIOT', 'Fenix', 'NEO', 'ALPEN', 'STRONG',
  'Camelion', 'ANDELI', 'DORI', 'General', 'ALUMET', 'KRAUSE',
  'VARTA', 'BRAUBERG', 'Эра', 'ERA', 'CUTOP',
  'STAVTOOL', 'BREZO',
];

function extractBrand(name) {
  const nameUpper = name.toUpperCase();
  // Сначала длинные бренды (Schneider Electric перед EKF)
  for (const brand of KNOWN_BRANDS) {
    if (nameUpper.includes(brand.toUpperCase())) {
      return brand;
    }
  }
  return '';
}

// ─── Формирование итогового каталога ────────────────────────────────────────
function buildCatalog(allProducts) {
  // Дедупликация по ID
  const seen = new Map();
  let dupes = 0;
  for (const p of allProducts) {
    if (seen.has(p.id)) {
      dupes++;
    } else {
      seen.set(p.id, p);
    }
  }
  if (dupes > 0) console.log(`  Дедупликация: убрано ${dupes} дублей`);

  const items = [...seen.values()].map(p => ({
    id: p.id,
    article: p.article || '',
    name: p.name,
    category: p.category,
    brand: extractBrand(p.name),
    price: p.price,
    oldPrice: p.oldPrice || undefined,
    inStock: p.canBuy,
    quantity: p.quantity,
    unit: p.unit || 'шт',
    photo: p.photo,
  }));

  return {
    lastUpdated: new Date().toISOString().slice(0, 10),
    source: 'stv39.ru',
    totalItems: items.length,
    items,
  };
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const limitCats = args.includes('--test') ? 2 : TOP_CATEGORIES.length;
  const isTest = args.includes('--test');

  const startTime = Date.now();
  const stats = { totalRequests: 0, totalTime: 0, slowResponses: 0, errors: 0 };

  console.log('');
  console.log('  ZalAssist — Парсер каталога stv39.ru');
  console.log('  ═══════════════════════════════════════');
  console.log(`  Режим: ${isTest ? 'ТЕСТ (2 категории)' : 'ПОЛНЫЙ (все 13 категорий)'}`);
  console.log(`  Задержка: ${CONFIG.delayMs}мс | Товаров/стр: ${CONFIG.itemsPerPage}`);
  console.log('');

  const allProducts = [];
  const categoriesToScrape = TOP_CATEGORIES.slice(0, limitCats);

  for (let i = 0; i < categoriesToScrape.length; i++) {
    const cat = categoriesToScrape[i];
    const pct = (((i + 1) / categoriesToScrape.length) * 100).toFixed(0);
    console.log(`\n[${pct}%] ${cat.name} (${i + 1}/${categoriesToScrape.length})`);

    const products = await scrapeCategory(cat, stats);
    allProducts.push(...products);
    console.log(`  => ${products.length} товаров | Всего собрано: ${allProducts.length}`);
  }

  console.log('\nСборка каталога...');
  const catalog = buildCatalog(allProducts);

  const outputPath = path.resolve(__dirname, '..', 'static', 'catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const avgTime = stats.totalRequests > 0 ? (stats.totalTime / stats.totalRequests).toFixed(0) : 0;

  console.log('');
  console.log('  ГОТОВО');
  console.log('  ═══════════════════════════════════════');
  console.log(`  Уникальных товаров: ${catalog.totalItems}`);
  console.log(`  Запросов к серверу: ${stats.totalRequests}`);
  console.log(`  Ошибок: ${stats.errors}`);
  console.log(`  Медленных ответов: ${stats.slowResponses}`);
  console.log(`  Ср. время ответа: ${avgTime}мс`);
  console.log(`  Общее время: ${elapsed}с`);
  console.log(`  Файл: ${outputPath}`);
  console.log('');

  if (isTest) {
    console.log('  Это был тестовый запуск. Для полного парсинга:');
    console.log('  node scripts/scrape-catalog.cjs');
    console.log('');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
