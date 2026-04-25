// Text-to-speech через браузерный SpeechSynthesis API.
// Качество русского голоса на iOS — хорошее (Siri/Milena), на Android — варьируется.
// На неподдерживаемых браузерах вызовы безопасно игнорируются.

let _voicesLoaded = false;
let _ruVoice = null;

function ensureVoices() {
	if (typeof window === "undefined" || _voicesLoaded) return;
	const synth = window.speechSynthesis;
	if (!synth) return;
	const voices = synth.getVoices();
	if (voices.length === 0) {
		// На некоторых платформах (Chrome) голоса грузятся асинхронно — слушаем
		synth.addEventListener("voiceschanged", ensureVoices, { once: true });
		return;
	}
	// Приоритет: ru-RU > просто содержит "ru" в lang/name
	_ruVoice =
		voices.find((v) => v.lang === "ru-RU") ||
		voices.find((v) => v.lang?.startsWith("ru")) ||
		voices.find((v) => /russian|русск/i.test(v.name));
	_voicesLoaded = true;
}

// Очистка текста перед озвучиванием — markdown, артикулы, маркеры,
// чтобы ИИ не зачитывал «звёздочка звёздочка» и не диктовал ABC-12345.
// maxLength: 0 = не обрезать (по умолчанию режем до 280 — в стиле Алисы).
export function sanitizeForSpeech(raw, { maxLength = 280 } = {}) {
	if (!raw) return "";
	let t = String(raw);
	// Маркеры [CHIPS: ...], [TAGS: ...] и любые квадратные блоки
	t = t.replace(/\[CHIPS:[^\]]*\]/gi, "");
	t = t.replace(/\[TAGS:[^\]]*\]/gi, "");
	// Артикулы целиком вырезаем — не «артикул-артикул-артикул» в речи,
	// а просто исключаем («модель», «вариант» — не зачитываем код)
	t = t.replace(/\b[A-ZА-Я]{2,}[-–]\d+[A-ZА-Я0-9-]*/g, "");
	// Цены вида "1840 ₽" / "1 840₽" — оставляем как есть, синтез прочитает
	// Markdown
	t = t.replace(/\*\*(.+?)\*\*/g, "$1");
	t = t.replace(/\*(.+?)\*/g, "$1");
	t = t.replace(/`([^`]+)`/g, "$1");
	t = t.replace(/^#+\s+/gm, "");
	// Маркированные списки → перечисление через запятую
	t = t.replace(/^[\-•*]\s+/gm, "");
	// Двойные пробелы и переводы строк
	t = t.replace(/\s+\n/g, "\n").replace(/\n{2,}/g, ". ").replace(/\s{2,}/g, " ");
	// Лишние знаки препинания после удалений
	t = t.replace(/\s+([.,;:!?])/g, "$1").replace(/\s*,\s*,+/g, ",");
	if (maxLength > 0 && t.length > maxLength) {
		const cut = t.slice(0, maxLength);
		const lastDot = cut.lastIndexOf(".");
		t = (lastDot > 80 ? cut.slice(0, lastDot + 1) : cut + "…");
	}
	return t.trim();
}

// Разбить текст на предложения для последовательной озвучки.
// Аккуратно с сокращениями (т.е., и т.д., и т.п.) — после них не делим.
function splitSentences(text) {
	if (!text) return [];
	// Защищаем сокращения временно меняя точку
	const protected_ = text
		.replace(/\bт\.\s?е\./g, "т·е·")
		.replace(/\bт\.\s?д\./g, "т·д·")
		.replace(/\bт\.\s?п\./g, "т·п·")
		.replace(/\bт\.\s?к\./g, "т·к·");
	const parts = protected_.split(/(?<=[.!?…])\s+/);
	return parts
		.map((s) => s.replace(/·/g, ".").trim())
		.filter(Boolean);
}

// Озвучить текст. Возвращает Promise который резолвится по окончании
// (или прерыванию) — удобно для hands-free loop.
export function speak(text, { onStart, onEnd, rate = 1.05, pitch = 1, volume = 1 } = {}) {
	return new Promise((resolve) => {
		if (typeof window === "undefined" || !window.speechSynthesis) {
			resolve("unsupported");
			return;
		}
		const clean = sanitizeForSpeech(text);
		if (!clean) {
			resolve("empty");
			return;
		}
		ensureVoices();
		const synth = window.speechSynthesis;
		// Останавливаем предыдущее озвучивание если было
		synth.cancel();

		const utter = new SpeechSynthesisUtterance(clean);
		utter.lang = "ru-RU";
		utter.rate = rate;
		utter.pitch = pitch;
		utter.volume = volume;
		if (_ruVoice) utter.voice = _ruVoice;

		utter.onstart = () => onStart?.();
		utter.onend = () => { onEnd?.(); resolve("done"); };
		utter.onerror = () => { onEnd?.(); resolve("error"); };

		synth.speak(utter);
	});
}

// Прервать любое текущее озвучивание (кнопка стоп / barge-in).
export function cancelSpeech() {
	if (typeof window !== "undefined" && window.speechSynthesis) {
		window.speechSynthesis.cancel();
	}
}

export function isSpeechSupported() {
	return typeof window !== "undefined" && !!window.speechSynthesis;
}

// Озвучить текст по предложениям — для синхронизации с UI/прерыванием.
// onSentenceStart(sentence) — вызывается перед каждым произнесённым куском.
// Возвращает Promise<"done"|"cancelled"|"empty"|"unsupported">.
export function speakSentences(text, { onSentenceStart, rate = 1.05, maxLength = 280 } = {}) {
	return new Promise(async (resolve) => {
		if (!isSpeechSupported()) { resolve("unsupported"); return; }
		const clean = sanitizeForSpeech(text, { maxLength });
		if (!clean) { resolve("empty"); return; }
		const sentences = splitSentences(clean);
		if (sentences.length === 0) { resolve("empty"); return; }

		ensureVoices();
		cancelSpeech();

		let cancelled = false;
		// Если в течение озвучки вызвали cancelSpeech() — прерываемся
		const watchCancel = setInterval(() => {
			if (typeof window !== "undefined" && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
				// если кто-то вызвал cancelSpeech() извне — speaking=false и нет очереди
			}
		}, 200);

		for (const sentence of sentences) {
			if (cancelled) break;
			onSentenceStart?.(sentence);
			const result = await new Promise((r) => {
				const utter = new SpeechSynthesisUtterance(sentence);
				utter.lang = "ru-RU";
				utter.rate = rate;
				if (_ruVoice) utter.voice = _ruVoice;
				utter.onend = () => r("ok");
				utter.onerror = () => r("err");
				window.speechSynthesis.speak(utter);
			});
			if (result !== "ok") { cancelled = true; break; }
		}
		clearInterval(watchCancel);
		resolve(cancelled ? "cancelled" : "done");
	});
}
