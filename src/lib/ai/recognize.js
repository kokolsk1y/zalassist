// Однократное распознавание речи через Web Speech API.
// Возвращает Promise с результатом + функцию прерывания.
// Используется в VoiceInput и в hands-free loop в чате.

export function isRecognitionSupported() {
	if (typeof window === "undefined") return false;
	return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// recognizeOnce({ onStart, onEnd, lang })
// Возвращает: { promise: Promise<string|null>, abort: () => void }
export function recognizeOnce({ onStart, onEnd, onError, lang = "ru-RU" } = {}) {
	if (!isRecognitionSupported()) {
		return { promise: Promise.resolve(null), abort: () => {} };
	}

	const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
	const rec = new SR();
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
		try {
			rec.start();
		} catch {
			resolve(null);
		}
	});

	return {
		promise,
		abort() {
			aborted = true;
			try { rec.abort(); } catch {}
		},
	};
}
