const WORKER_URL = "https://zalassist-api.ikokolsk1y.workers.dev";

/**
 * Отправить сообщение и стримить ответ от ИИ.
 * @param {Object} params
 * @param {string} params.message — сообщение пользователя (до 500 символов)
 * @param {Array} params.history — история [{role, content}], макс 20
 * @param {string} params.catalog — компактный каталог (из formatCatalogForAI)
 * @param {function} params.onChunk — вызывается с (chunk, fullText) на каждый фрагмент
 * @param {function} params.onDone — вызывается с (fullText) при завершении
 * @param {function} params.onError — вызывается с (errorMessage) при ошибке
 * @returns {function} abort — функция отмены запроса
 */
export function streamChat({ message, history, catalog, onChunk, onDone, onError }) {
	const controller = new AbortController();

	(async () => {
		try {
			const response = await fetch(WORKER_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message, history, catalog }),
				signal: controller.signal
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				if (response.status === 429) {
					onError?.("Слишком много запросов. Подождите немного.");
				} else if (response.status === 400) {
					onError?.(err.error || "Некорректный запрос");
				} else {
					onError?.("Сервис временно недоступен");
				}
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullText = "";
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (line.startsWith(":")) continue;
					if (!line.startsWith("data: ")) continue;

					const data = line.slice(6);
					if (data === "[DONE]") {
						onDone?.(fullText);
						return;
					}

					try {
						const parsed = JSON.parse(data);
						const content = parsed.choices?.[0]?.delta?.content;
						if (content) {
							fullText += content;
							onChunk?.(content, fullText);
						}
					} catch {
						// Невалидный JSON — пропустить
					}
				}
			}

			// Стрим завершился без [DONE]
			if (fullText) onDone?.(fullText);
		} catch (err) {
			if (err.name === "AbortError") return;
			onError?.("Ошибка соединения. Проверьте интернет.");
		}
	})();

	return () => controller.abort();
}
