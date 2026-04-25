// Контактная информация ЭлектроЦентра — единая точка правды.
// Если адрес/телефон изменятся — менять только здесь.

export const STORE = {
	name: "ЭлектроЦентр",
	site: "https://stv39.ru",
	// Тот же номер что используется в CartPanel для WhatsApp-связи с менеджером
	phone: "+74012555514",
	phoneDisplay: "+7 (4012) 55-55-14",
	// Поиск магазина по названию в Яндекс.Картах — построит маршрут от текущей позиции пользователя.
	// Если будет известен точный адрес/object id — заменить на постоянную ссылку.
	mapsQuery: "ЭлектроЦентр Калининград",
	// Часы работы. Если расписание изменится — менять только тут.
	// День недели: 0=вс, 1=пн, ..., 6=сб (как у Date.getDay())
	// null = выходной. Время в формате "HH:MM" — локальное время Калининграда (UTC+2).
	hours: {
		1: { open: "09:00", close: "19:00" }, // Пн
		2: { open: "09:00", close: "19:00" }, // Вт
		3: { open: "09:00", close: "19:00" }, // Ср
		4: { open: "09:00", close: "19:00" }, // Чт
		5: { open: "09:00", close: "19:00" }, // Пт
		6: { open: "10:00", close: "17:00" }, // Сб
		0: null, // Вс — выходной
	},
};

const DAYS_RU = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"];
const DAYS_RU_NOM = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function parseHM(hm) {
	const [h, m] = hm.split(":").map(Number);
	return h * 60 + m;
}

// Возвращает текущий статус магазина: { isOpen, label, until }
// label — короткая строка для UI («Открыто до 19:00» / «Закрыто, откроется в пн в 9:00»)
export function getStoreStatus(now = new Date()) {
	const day = now.getDay();
	const minutes = now.getHours() * 60 + now.getMinutes();
	const today = STORE.hours[day];

	if (today) {
		const openMin = parseHM(today.open);
		const closeMin = parseHM(today.close);
		if (minutes >= openMin && minutes < closeMin) {
			return { isOpen: true, label: `Открыто до ${today.close}` };
		}
		if (minutes < openMin) {
			return { isOpen: false, label: `Закрыто, откроется сегодня в ${today.open}` };
		}
	}

	// Магазин закрыт сейчас — ищем ближайший рабочий день
	for (let i = 1; i <= 7; i++) {
		const d = (day + i) % 7;
		const sched = STORE.hours[d];
		if (sched) {
			const dayLabel = i === 1 ? "завтра" : `в ${DAYS_RU[d]}`;
			return { isOpen: false, label: `Закрыто, откроется ${dayLabel} в ${sched.open}` };
		}
	}
	return { isOpen: false, label: "Расписание уточняйте" };
}

export function callPhone() {
	// tel: схема — телефон сразу набирает номер, без запроса подтверждения
	return `tel:${STORE.phone}`;
}

export function openInMaps() {
	// Яндекс.Карты — на устройствах где установлено приложение откроется в нём,
	// иначе в браузере. Не Google — у них в РФ хуже покрытие.
	return `https://yandex.ru/maps/?text=${encodeURIComponent(STORE.mapsQuery)}&rtext=~&rtt=auto`;
}
