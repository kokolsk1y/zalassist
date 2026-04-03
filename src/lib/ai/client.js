const WORKER_URL = "https://api.kokolsk1y.ru/api/chat";

/**
 * Отправить сообщение ИИ. Без стриминга — ждёт полный ответ.
 */
export function streamChat({ message, history, catalog, onChunk, onDone, onError }) {
	const controller = new AbortController();

	(async () => {
		try {
			onChunk?.("⏳ Думаю...", "⏳ Думаю...");

			const response = await fetch(WORKER_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message, history, catalog, stream: false }),
				signal: controller.signal
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				onError?.(err.error || "Сервис временно недоступен (код " + response.status + ")");
				return;
			}

			const data = await response.json();
			const text = data.text || "";

			if (!text) {
				onError?.("Пустой ответ от ИИ");
				return;
			}

			// Показываем текст пословно для плавности
			let fullText = "";
			const words = text.split(" ");
			for (let i = 0; i < words.length; i++) {
				const word = (i > 0 ? " " : "") + words[i];
				fullText += word;
				onChunk?.(word, fullText);
				await new Promise(r => setTimeout(r, 30));
			}

			onDone?.(fullText);
		} catch (err) {
			if (err.name === "AbortError") return;
			onError?.("Ошибка: " + err.message);
		}
	})();

	return () => controller.abort();
}
