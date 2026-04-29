const API_URL = "https://functions.yandexcloud.net/d4e3bfsiqg0jbf7b99jg";

import { getStoreStatus } from "$lib/data/store-info.js";

const DAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

// Контекст времени для ИИ: даём текущий день недели, время и статус магазина
// (открыт/закрыт + до скольки/откроется когда). Это спасает от ответов вида
// «завтра с 9 до 18» когда ИИ не знает реальный день недели.
function buildTimeContext() {
	const now = new Date();
	const day = DAYS[now.getDay()];
	const hh = String(now.getHours()).padStart(2, "0");
	const mm = String(now.getMinutes()).padStart(2, "0");
	const status = getStoreStatus(now);
	return {
		weekday: day,
		time: `${hh}:${mm}`,
		isOpen: status.isOpen,
		statusLabel: status.label,
	};
}

/**
 * Отправить сообщение ИИ.
 * catalogSubset — предварительно отобранные товары (30-50 шт) для промпта.
 *
 * Стратегия таймаутов:
 *   1-я попытка — 50s. Yandex Cloud Function может холодить (cold start ~1-3s)
 *      + OpenRouter иногда уходит в долгие ответы при fallback на gpt-4o.
 *      CF-таймаут 60s с запасом покрывает эту попытку.
 *   2-я попытка — 30s. Функция уже прогрета, отвечает быстро либо никогда.
 *
 * Раньше было 3×30s = до 90s ожидания пользователем «таймаут», что бесполезно
 * — все 3 попытки попадали в один и тот же CF execution_timeout=30s.
 */
const TIMEOUTS_MS = [50000, 30000];

export function streamChat({ message, history, catalogSubset, onChunk, onDone, onError }) {
	let cancelled = false;

	(async () => {
		try {
			onChunk?.("", "");

			const body = JSON.stringify({ message, history, catalog: catalogSubset, timeContext: buildTimeContext() });

			let data;
			let lastError = null;
			for (let attempt = 0; attempt < TIMEOUTS_MS.length; attempt++) {
				if (cancelled) return;
				if (attempt > 0) {
					await new Promise(r => setTimeout(r, 1500));
					onChunk?.("", "Повторная попытка...");
				}

				try {
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), TIMEOUTS_MS[attempt]);

					const response = await fetch(API_URL, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body,
						signal: controller.signal,
					});

					clearTimeout(timeout);

					if (!response.ok) {
						const err = await response.json().catch(() => ({}));
						throw new Error(err.error || "Код " + response.status);
					}

					data = await response.json();
					lastError = null;
					break;
				} catch (e) {
					lastError = e.name === "AbortError"
						? new Error("Таймаут — сервер не ответил")
						: e;
				}
			}

			if (lastError) throw lastError;
			if (cancelled) return;

			const text = data?.text || "";
			if (!text) {
				onError?.("Пустой ответ от ИИ");
				return;
			}

			// Показываем текст пословно
			let fullText = "";
			const words = text.split(" ");
			for (let i = 0; i < words.length; i++) {
				if (cancelled) return;
				const word = (i > 0 ? " " : "") + words[i];
				fullText += word;
				onChunk?.(word, fullText);
				await new Promise(r => setTimeout(r, 20));
			}

			onDone?.(fullText);
		} catch (err) {
			if (cancelled) return;
			onError?.(err.message || "Ошибка соединения");
		}
	})();

	return () => { cancelled = true; };
}
