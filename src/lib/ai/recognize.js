// Распознавание речи через Web Speech API.
// Два режима использования:
//
// 1) recognizeOnce()   — короткая фраза (как Алиса/Siri): прервётся на первой паузе
// 2) recognizeStream() — длинная фраза с непрерывным распознаванием + промежуточные
//                        результаты по ходу речи (как голосовое в Telegram). Нужно
//                        останавливать вручную через abort/finalize.
//
// Возможные ошибки от Web Speech API: not-allowed (нет разрешения),
// no-speech (тишина), audio-capture (нет микрофона), network, aborted.

export function isRecognitionSupported() {
	if (typeof window === "undefined") return false;
	return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function createSR() {
	if (!isRecognitionSupported()) return null;
	const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
	return new SR();
}

// === Короткое распознавание (одна фраза) ===
export function recognizeOnce({ onStart, onEnd, onError, lang = "ru-RU" } = {}) {
	const rec = createSR();
	if (!rec) return { promise: Promise.resolve(null), abort: () => {} };

	rec.lang = lang;
	rec.interimResults = false;
	rec.maxAlternatives = 1;
	rec.continuous = false;

	let aborted = false;

	const promise = new Promise((resolve) => {
		rec.onstart = () => onStart?.();
		rec.onresult = (e) => {
			const text = e?.results?.[0]?.[0]?.transcript || "";
			resolve(text);
		};
		rec.onerror = (e) => {
			onError?.(e?.error || "unknown");
			resolve(null);
		};
		rec.onend = () => {
			onEnd?.();
			if (aborted) resolve(null);
		};
		try { rec.start(); } catch { resolve(null); }
	});

	return {
		promise,
		abort() {
			aborted = true;
			try { rec.abort(); } catch {}
		},
	};
}

// === Стрим-распознавание для push-to-hold (Telegram-style) ===
// Возвращает объект с методами:
//   - finalize() — остановить и получить итоговый текст (отпустил кнопку)
//   - cancel()   — отменить без результата (свайп влево)
// И коллбэками:
//   - onPartial(text)   — промежуточный текст по ходу речи (для отображения)
//   - onError(err)      — ошибки распознавания
//
// finalize() возвращает Promise<string|null> — финальный распознанный текст.
export function recognizeStream({ onPartial, onError, lang = "ru-RU" } = {}) {
	const rec = createSR();
	if (!rec) {
		return {
			finalize: async () => null,
			cancel: () => {},
		};
	}

	rec.lang = lang;
	rec.interimResults = true;
	rec.maxAlternatives = 1;
	rec.continuous = true;

	let finalText = "";
	let cancelled = false;
	let endResolver = null;

	rec.onresult = (e) => {
		let interim = "";
		for (let i = e.resultIndex; i < e.results.length; i++) {
			const transcript = e.results[i][0].transcript;
			if (e.results[i].isFinal) {
				finalText += transcript;
			} else {
				interim += transcript;
			}
		}
		onPartial?.((finalText + " " + interim).trim());
	};

	rec.onerror = (e) => {
		const err = e?.error || "unknown";
		// "no-speech" и "aborted" — нормальные при отпускании, не уведомляем
		if (err !== "no-speech" && err !== "aborted") {
			onError?.(err);
		}
	};

	rec.onend = () => {
		if (endResolver) {
			endResolver(cancelled ? null : (finalText.trim() || null));
			endResolver = null;
		}
	};

	try { rec.start(); } catch (e) { onError?.("start-failed"); }

	return {
		finalize() {
			return new Promise((resolve) => {
				endResolver = resolve;
				try { rec.stop(); } catch { resolve(finalText.trim() || null); }
			});
		},
		cancel() {
			cancelled = true;
			try { rec.abort(); } catch {}
		},
	};
}
