// Тактильные отклики через Vibration API.
// Работает на Android Chrome/Firefox; на iOS Safari API отключено Apple — вызовы игнорируются (?.).
// Длительности подобраны под «нативное» ощущение, ограничиваем чтобы не задрожать долго.

function safe(pattern) {
	if (typeof navigator === "undefined") return;
	navigator.vibrate?.(pattern);
}

// Лёгкий тап — добавление в подбор, выбор чипса, тыки по вкладкам.
export function tap() { safe(10); }

// Успех — товар успешно отсканирован, найден, отправлен.
export function success() { safe([15, 30, 15]); }

// Ошибка — сеть отвалилась, не нашли товар, не удалось.
export function error() { safe([40, 60, 40]); }

// Long-press / контекстное меню — сильный одиночный пульс.
export function longPress() { safe(25); }
