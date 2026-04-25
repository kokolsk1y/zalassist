import { copyToClipboard } from "./clipboard.js";

// Web Share API — нативное системное «Поделиться»: WhatsApp / AirDrop / заметки / почта…
// Клиент сам выбирает канал. На iOS/Android Chrome работает; на десктопе и
// в браузерах без Share API делаем fallback на копирование в буфер.
//
// Возвращает: "shared" | "copied" | "cancelled" | "error"
export async function shareText({ title, text, url }) {
	if (typeof navigator === "undefined") return "error";

	// canShare опционален и поддерживается не везде; пропускаем проверку если его нет
	if (navigator.share) {
		try {
			await navigator.share({ title, text, url });
			return "shared";
		} catch (e) {
			// AbortError — пользователь нажал «Отмена» в системном меню — это не ошибка
			if (e?.name === "AbortError") return "cancelled";
			// иначе падаем в fallback
		}
	}

	// Fallback: копируем в буфер
	const payload = [title, text, url].filter(Boolean).join("\n");
	const ok = await copyToClipboard(payload);
	return ok ? "copied" : "error";
}

export function canNativeShare() {
	return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
