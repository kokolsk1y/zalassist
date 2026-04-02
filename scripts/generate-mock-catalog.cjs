'use strict';

const fs = require('fs');
const path = require('path');

// ─── Данные для генерации ───────────────────────────────────────────────────

const BRANDS = ['IEK', 'ABB', 'EKF', 'Schneider Electric', 'Legrand', 'TDM'];

const CATEGORIES = {
  'Автоматические выключатели': {
    subcategories: ['Модульные автоматы', 'Автоматы в литом корпусе'],
    unit: 'шт',
    brands: ['IEK', 'ABB', 'EKF', 'Schneider Electric'],
    items: [
      {
        articleTpl: 'BA47-29-1P-{A}A',
        nameTpl: 'Автоматический выключатель ВА47-29 1P {A}А 4,5кА С IEK',
        brand: 'IEK',
        descTpl: 'Однополюсный автоматический выключатель {A}А для защиты цепей',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Число полюсов': '1P', 'Характеристика': 'С', 'Откл. способность': '4,5кА' }),
        currents: [6, 10, 16, 20, 25, 32],
        subcategory: 'Модульные автоматы',
      },
      {
        articleTpl: 'BA47-29-2P-{A}A',
        nameTpl: 'Автоматический выключатель ВА47-29 2P {A}А 4,5кА С IEK',
        brand: 'IEK',
        descTpl: 'Двухполюсный автоматический выключатель {A}А для защиты цепей',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Число полюсов': '2P', 'Характеристика': 'С', 'Откл. способность': '4,5кА' }),
        currents: [16, 20, 25, 32, 40],
        subcategory: 'Модульные автоматы',
      },
      {
        articleTpl: 'S201-{A}A-ABB',
        nameTpl: 'Автоматический выключатель ABB S201 1P {A}А 6кА C',
        brand: 'ABB',
        descTpl: 'Однополюсный автоматический выключатель ABB S201 {A}А',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Число полюсов': '1P', 'Характеристика': 'C', 'Откл. способность': '6кА' }),
        currents: [10, 16, 25, 32],
        subcategory: 'Модульные автоматы',
      },
      {
        articleTpl: 'EZD100-3P-{A}A-EKF',
        nameTpl: 'Автоматический выключатель EKF ВА-99C 3P {A}А 10кА',
        brand: 'EKF',
        descTpl: 'Трёхполюсный автомат в литом корпусе {A}А',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Число полюсов': '3P', 'Характеристика': 'С', 'Откл. способность': '10кА' }),
        currents: [63, 80, 100],
        subcategory: 'Автоматы в литом корпусе',
      },
    ],
  },

  'УЗО': {
    subcategories: ['Электронные УЗО', 'Электромеханические УЗО'],
    unit: 'шт',
    items: [
      {
        articleTpl: 'VD1-63-2P-{A}A-30MA-IEK',
        nameTpl: 'УЗО ВД1-63 2P {A}А 30мА тип А IEK',
        brand: 'IEK',
        descTpl: 'Устройство защитного отключения {A}А 30мА двухполюсное',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Ток утечки': '30мА', 'Число полюсов': '2P', 'Тип': 'А' }),
        currents: [16, 25, 32, 40, 63],
        subcategory: 'Электронные УЗО',
      },
      {
        articleTpl: 'F202-{A}A-30MA-ABB',
        nameTpl: 'УЗО ABB F202 AC-{A}/0,03 2P {A}А 30мА',
        brand: 'ABB',
        descTpl: 'Электромеханическое УЗО ABB F202 {A}А 30мА',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Ток утечки': '30мА', 'Число полюсов': '2P', 'Тип': 'AC' }),
        currents: [25, 40, 63],
        subcategory: 'Электромеханические УЗО',
      },
    ],
  },

  'АВДТ (дифавтоматы)': {
    subcategories: ['Дифавтоматы однофазные'],
    unit: 'шт',
    items: [
      {
        articleTpl: 'AVDT32-C{A}-30MA-IEK',
        nameTpl: 'Дифавтомат АВДТ32 C{A} 30мА тип А IEK',
        brand: 'IEK',
        descTpl: 'Автоматический выключатель дифференциального тока C{A}А 30мА',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Ток утечки': '30мА', 'Характеристика': 'C', 'Число полюсов': '2P' }),
        currents: [10, 16, 20, 25, 32],
        subcategory: 'Дифавтоматы однофазные',
      },
      {
        articleTpl: 'DS201-C{A}-30MA-ABB',
        nameTpl: 'Дифавтомат ABB DS201 C{A} 30мА тип A',
        brand: 'ABB',
        descTpl: 'Дифференциальный автомат ABB DS201 {A}А 30мА',
        specsFn: (a) => ({ 'Номинальный ток': `${a}А`, 'Ток утечки': '30мА', 'Характеристика': 'C', 'Число полюсов': '2P' }),
        currents: [16, 20, 25],
        subcategory: 'Дифавтоматы однофазные',
      },
    ],
  },

  'Кабель и провод': {
    subcategories: ['Силовые кабели', 'Провода установочные'],
    unit: 'м',
    items: [
      {
        articleTpl: 'VVGng-3x{S}',
        nameTpl: 'Кабель ВВГнг(А) 3х{S} мм² 0,66кВ',
        brand: 'TDM',
        descTpl: 'Силовой кабель ВВГнг(А) 3 жилы {S} мм² негорючий',
        specsFn: (s) => ({ 'Сечение': `${s} мм²`, 'Жилы': '3', 'Напряжение': '0,66кВ', 'Исполнение': 'нг(А)' }),
        currents: ['1.5', '2.5', '4', '6', '10'],
        subcategory: 'Силовые кабели',
        articleKey: 'section',
      },
      {
        articleTpl: 'VVGng-5x{S}',
        nameTpl: 'Кабель ВВГнг(А) 5х{S} мм² 0,66кВ',
        brand: 'TDM',
        descTpl: 'Силовой кабель ВВГнг(А) 5 жил {S} мм²',
        specsFn: (s) => ({ 'Сечение': `${s} мм²`, 'Жилы': '5', 'Напряжение': '0,66кВ', 'Исполнение': 'нг(А)' }),
        currents: ['2.5', '4', '6'],
        subcategory: 'Силовые кабели',
        articleKey: 'section',
      },
      {
        articleTpl: 'PVS-2x{S}',
        nameTpl: 'Провод ПВС 2х{S} мм²',
        brand: 'IEK',
        descTpl: 'Провод соединительный ПВС 2 жилы {S} мм²',
        specsFn: (s) => ({ 'Сечение': `${s} мм²`, 'Жилы': '2', 'Тип': 'ПВС' }),
        currents: ['0.75', '1.0', '1.5', '2.5'],
        subcategory: 'Провода установочные',
        articleKey: 'section',
      },
    ],
  },

  'Розетки и выключатели': {
    subcategories: ['Розетки', 'Выключатели', 'Рамки и накладки'],
    unit: 'шт',
    items: [
      {
        article: 'RZ-16-2K-W-IEK',
        name: 'Розетка 2К+З 16А IP20 белая IEK',
        brand: 'IEK',
        desc: 'Розетка с заземлением 16А скрытой установки белая',
        specs: { 'Ток': '16А', 'Тип': '2К+З', 'Степень защиты': 'IP20', 'Цвет': 'Белый' },
        subcategory: 'Розетки',
      },
      {
        article: 'RZ-16-2K-Z-IP44-IEK',
        name: 'Розетка 2К+З 16А IP44 наружная IEK',
        brand: 'IEK',
        desc: 'Розетка с заземлением IP44 для наружной установки',
        specs: { 'Ток': '16А', 'Тип': '2К+З', 'Степень защиты': 'IP44', 'Установка': 'Наружная' },
        subcategory: 'Розетки',
      },
      {
        article: 'RZ-16-2K-W-LGR',
        name: 'Розетка Legrand Valena 2К+З 16А белая',
        brand: 'Legrand',
        desc: 'Розетка с заземлением Legrand Valena 16А',
        specs: { 'Ток': '16А', 'Тип': '2К+З', 'Серия': 'Valena', 'Цвет': 'Белый' },
        subcategory: 'Розетки',
      },
      {
        article: 'SW-1K-W-IEK',
        name: 'Выключатель 1-клавишный 10А IP20 белый IEK',
        brand: 'IEK',
        desc: 'Выключатель одноклавишный 10А скрытой установки',
        specs: { 'Ток': '10А', 'Клавиши': '1', 'Степень защиты': 'IP20', 'Цвет': 'Белый' },
        subcategory: 'Выключатели',
      },
      {
        article: 'SW-2K-W-IEK',
        name: 'Выключатель 2-клавишный 10А IP20 белый IEK',
        brand: 'IEK',
        desc: 'Выключатель двухклавишный 10А скрытой установки',
        specs: { 'Ток': '10А', 'Клавиши': '2', 'Степень защиты': 'IP20', 'Цвет': 'Белый' },
        subcategory: 'Выключатели',
      },
      {
        article: 'SW-1K-W-LGR',
        name: 'Выключатель Legrand Valena 1-клавишный белый',
        brand: 'Legrand',
        desc: 'Выключатель одноклавишный Legrand Valena 10А',
        specs: { 'Ток': '10А', 'Клавиши': '1', 'Серия': 'Valena', 'Цвет': 'Белый' },
        subcategory: 'Выключатели',
      },
      {
        article: 'SW-1K-PASS-W-IEK',
        name: 'Выключатель проходной 1-клавишный 10А белый IEK',
        brand: 'IEK',
        desc: 'Проходной выключатель для управления светом из двух мест',
        specs: { 'Ток': '10А', 'Тип': 'Проходной', 'Клавиши': '1', 'Цвет': 'Белый' },
        subcategory: 'Выключатели',
      },
    ],
  },

  'Щиты и боксы': {
    subcategories: ['Щиты навесные', 'Щиты встраиваемые', 'Боксы пластиковые'],
    unit: 'шт',
    items: [
      {
        article: 'SHHB-12-W-IEK',
        name: 'Щит распределительный ЩРН-12 навесной 12 мест IEK',
        brand: 'IEK',
        desc: 'Навесной щит на 12 модулей с шиной нулей и шиной PE',
        specs: { 'Количество мест': '12', 'Тип': 'Навесной', 'Материал': 'Сталь', 'Цвет': 'Белый' },
        subcategory: 'Щиты навесные',
      },
      {
        article: 'SHHB-24-W-IEK',
        name: 'Щит распределительный ЩРН-24 навесной 24 места IEK',
        brand: 'IEK',
        desc: 'Навесной щит на 24 модуля',
        specs: { 'Количество мест': '24', 'Тип': 'Навесной', 'Материал': 'Сталь' },
        subcategory: 'Щиты навесные',
      },
      {
        article: 'SHHRV-12-W-IEK',
        name: 'Щит распределительный ЩРВ-12 встраиваемый 12 мест IEK',
        brand: 'IEK',
        desc: 'Встраиваемый щит на 12 модулей для скрытого монтажа',
        specs: { 'Количество мест': '12', 'Тип': 'Встраиваемый', 'Материал': 'Сталь' },
        subcategory: 'Щиты встраиваемые',
      },
      {
        article: 'SHHRV-24-W-IEK',
        name: 'Щит распределительный ЩРВ-24 встраиваемый 24 места IEK',
        brand: 'IEK',
        desc: 'Встраиваемый щит на 24 модуля для скрытого монтажа',
        specs: { 'Количество мест': '24', 'Тип': 'Встраиваемый', 'Материал': 'Сталь' },
        subcategory: 'Щиты встраиваемые',
      },
      {
        article: 'BOX-IP65-PLT-IEK',
        name: 'Бокс пластиковый IP65 200x150x80 IEK',
        brand: 'IEK',
        desc: 'Бокс пластиковый герметичный IP65 для наружного монтажа',
        specs: { 'Степень защиты': 'IP65', 'Размер': '200x150x80 мм', 'Материал': 'Пластик' },
        subcategory: 'Боксы пластиковые',
      },
      {
        article: 'BOX-IP65-PLT-ABB',
        name: 'Бокс пластиковый ABB IP65 300x200x120',
        brand: 'ABB',
        desc: 'Герметичный пластиковый бокс ABB для уличного применения',
        specs: { 'Степень защиты': 'IP65', 'Размер': '300x200x120 мм', 'Материал': 'Пластик' },
        subcategory: 'Боксы пластиковые',
      },
    ],
  },

  'Освещение': {
    subcategories: ['Светодиодные лампы', 'Светильники накладные', 'Светильники промышленные'],
    unit: 'шт',
    items: [
      {
        article: 'LED-A60-10W-E27-4000K-IEK',
        name: 'Лампа светодиодная A60 10Вт E27 4000К IEK',
        brand: 'IEK',
        desc: 'Светодиодная лампа A60 10Вт нейтральный белый свет',
        specs: { 'Мощность': '10Вт', 'Цоколь': 'E27', 'Цветовая температура': '4000К', 'Световой поток': '900лм' },
        subcategory: 'Светодиодные лампы',
      },
      {
        article: 'LED-A60-10W-E27-6500K-IEK',
        name: 'Лампа светодиодная A60 10Вт E27 6500К IEK',
        brand: 'IEK',
        desc: 'Светодиодная лампа A60 10Вт холодный белый свет',
        specs: { 'Мощность': '10Вт', 'Цоколь': 'E27', 'Цветовая температура': '6500К', 'Световой поток': '900лм' },
        subcategory: 'Светодиодные лампы',
      },
      {
        article: 'LED-GX53-12W-4000K-EKF',
        name: 'Лампа светодиодная GX53 12Вт 4000К EKF',
        brand: 'EKF',
        desc: 'Лампа светодиодная GX53 для встраиваемых светильников',
        specs: { 'Мощность': '12Вт', 'Цоколь': 'GX53', 'Цветовая температура': '4000К', 'Световой поток': '1100лм' },
        subcategory: 'Светодиодные лампы',
      },
      {
        article: 'LED-T8-18W-1200-4000K-IEK',
        name: 'Лампа светодиодная T8 18Вт G13 1200мм 4000К IEK',
        brand: 'IEK',
        desc: 'Светодиодная трубка T8 для замены люминесцентных ламп',
        specs: { 'Мощность': '18Вт', 'Цоколь': 'G13', 'Длина': '1200мм', 'Цветовая температура': '4000К' },
        subcategory: 'Светодиодные лампы',
      },
      {
        article: 'SPOT-GX53-IP20-W-IEK',
        name: 'Светильник встраиваемый GX53 IP20 белый IEK',
        brand: 'IEK',
        desc: 'Светильник встраиваемый под лампу GX53 для натяжных потолков',
        specs: { 'Тип': 'Встраиваемый', 'Цоколь': 'GX53', 'Степень защиты': 'IP20', 'Цвет': 'Белый' },
        subcategory: 'Светильники накладные',
      },
      {
        article: 'PANEL-LED-36W-595-4000K-IEK',
        name: 'Панель светодиодная 36Вт 595х595 4000К IEK',
        brand: 'IEK',
        desc: 'Светодиодная панель для офисного освещения 595x595мм',
        specs: { 'Мощность': '36Вт', 'Размер': '595x595мм', 'Цветовая температура': '4000К', 'Световой поток': '3200лм' },
        subcategory: 'Светильники накладные',
      },
      {
        article: 'IND-LED-50W-IP65-5000K-EKF',
        name: 'Светильник промышленный LED 50Вт IP65 5000К EKF',
        brand: 'EKF',
        desc: 'Промышленный светодиодный светильник для складов и производств',
        specs: { 'Мощность': '50Вт', 'Степень защиты': 'IP65', 'Цветовая температура': '5000К', 'Световой поток': '5000лм' },
        subcategory: 'Светильники промышленные',
      },
    ],
  },

  'Кабельные каналы': {
    subcategories: ['Кабельные каналы ПВХ', 'Гофрированные трубы', 'Металлорукав'],
    unit: 'м',
    items: [
      {
        article: 'KK-25x16-W-IEK',
        name: 'Кабельный канал 25х16 мм ПВХ белый IEK',
        brand: 'IEK',
        desc: 'Кабельный канал ПВХ 25х16мм для открытой прокладки кабелей',
        specs: { 'Размер': '25x16 мм', 'Материал': 'ПВХ', 'Цвет': 'Белый', 'Длина': '2м' },
        subcategory: 'Кабельные каналы ПВХ',
      },
      {
        article: 'KK-40x25-W-IEK',
        name: 'Кабельный канал 40х25 мм ПВХ белый IEK',
        brand: 'IEK',
        desc: 'Кабельный канал ПВХ 40х25мм',
        specs: { 'Размер': '40x25 мм', 'Материал': 'ПВХ', 'Цвет': 'Белый', 'Длина': '2м' },
        subcategory: 'Кабельные каналы ПВХ',
      },
      {
        article: 'KK-60x40-W-IEK',
        name: 'Кабельный канал 60х40 мм ПВХ белый IEK',
        brand: 'IEK',
        desc: 'Кабельный канал ПВХ 60х40мм',
        specs: { 'Размер': '60x40 мм', 'Материал': 'ПВХ', 'Цвет': 'Белый', 'Длина': '2м' },
        subcategory: 'Кабельные каналы ПВХ',
      },
      {
        article: 'KK-100x60-W-LGR',
        name: 'Кабельный канал Legrand 100х60 мм белый',
        brand: 'Legrand',
        desc: 'Кабельный канал Legrand DLP 100х60мм',
        specs: { 'Размер': '100x60 мм', 'Серия': 'DLP', 'Цвет': 'Белый', 'Длина': '2м' },
        subcategory: 'Кабельные каналы ПВХ',
      },
      {
        article: 'GROF-16-IEK',
        name: 'Труба гофрированная ПВХ d16мм IEK',
        brand: 'IEK',
        desc: 'Гофрированная труба ПВХ диаметром 16мм для скрытой прокладки',
        specs: { 'Диаметр': '16 мм', 'Материал': 'ПВХ', 'Тип': 'Гофрированная' },
        subcategory: 'Гофрированные трубы',
      },
      {
        article: 'GROF-20-IEK',
        name: 'Труба гофрированная ПВХ d20мм IEK',
        brand: 'IEK',
        desc: 'Гофрированная труба ПВХ диаметром 20мм',
        specs: { 'Диаметр': '20 мм', 'Материал': 'ПВХ', 'Тип': 'Гофрированная' },
        subcategory: 'Гофрированные трубы',
      },
      {
        article: 'GROF-25-IEK',
        name: 'Труба гофрированная ПВХ d25мм IEK',
        brand: 'IEK',
        desc: 'Гофрированная труба ПВХ диаметром 25мм',
        specs: { 'Диаметр': '25 мм', 'Материал': 'ПВХ', 'Тип': 'Гофрированная' },
        subcategory: 'Гофрированные трубы',
      },
      {
        article: 'MRUK-15-IEK',
        name: 'Металлорукав РЗ-Ц-15 d15мм IEK',
        brand: 'IEK',
        desc: 'Металлорукав в ПВХ оболочке диаметром 15мм',
        specs: { 'Диаметр': '15 мм', 'Тип': 'В оболочке ПВХ', 'Материал': 'Сталь оцинкованная' },
        subcategory: 'Металлорукав',
      },
    ],
  },
};

// ─── Генерация позиций ───────────────────────────────────────────────────────

function generateItems() {
  const items = [];
  let id = 1;

  // Счётчик для распределения inStock: 85% true, 15% false
  let inStockCounter = 0;

  function nextInStock() {
    inStockCounter++;
    // Каждая 7-я позиция — отсутствует (~15%)
    return inStockCounter % 7 !== 0;
  }

  for (const [category, catData] of Object.entries(CATEGORIES)) {
    for (const itemDef of catData.items) {
      // Если у позиции фиксированный артикул (не шаблонный)
      if (itemDef.article) {
        items.push({
          id: id++,
          article: itemDef.article,
          name: itemDef.name,
          category,
          subcategory: itemDef.subcategory,
          brand: itemDef.brand,
          description: itemDef.desc,
          specs: itemDef.specs,
          inStock: nextInStock(),
          unit: catData.unit,
        });
        continue;
      }

      // Шаблонные позиции (перебираем токи/сечения)
      for (const val of itemDef.currents) {
        const strVal = String(val);
        const article = itemDef.articleTpl.replace(/\{A\}/g, strVal).replace(/\{S\}/g, strVal);
        const name = itemDef.nameTpl.replace(/\{A\}/g, strVal).replace(/\{S\}/g, strVal);
        const desc = itemDef.descTpl.replace(/\{A\}/g, strVal).replace(/\{S\}/g, strVal);
        const specs = itemDef.specsFn(strVal);

        items.push({
          id: id++,
          article,
          name,
          category,
          subcategory: itemDef.subcategory,
          brand: itemDef.brand,
          description: desc,
          specs,
          inStock: nextInStock(),
          unit: catData.unit,
        });
      }
    }
  }

  return items;
}

// ─── Запись файла ────────────────────────────────────────────────────────────

function main() {
  const items = generateItems();

  const catalog = {
    lastUpdated: '2026-04-01',
    items,
  };

  const outputPath = path.resolve(__dirname, '..', 'static', 'catalog.json');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf-8');

  console.log(`Каталог сгенерирован: ${items.length} товаров`);
  console.log(`Файл записан: ${outputPath}`);

  // Подсчёт статистики
  const inStockCount = items.filter((i) => i.inStock).length;
  const categories = [...new Set(items.map((i) => i.category))];
  console.log(`В наличии: ${inStockCount} / ${items.length} (${Math.round((inStockCount / items.length) * 100)}%)`);
  console.log(`Категорий: ${categories.length}`);
  console.log(`Категории: ${categories.join(', ')}`);
}

main();
