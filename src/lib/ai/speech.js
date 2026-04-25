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
export function sanitizeForSpeech(raw) {
	if (!raw) return "";
	let t = String(raw);
	// Маркеры [CHIPS: ...], [TAGS: ...] и любые квадратные блоки
	t = t.replace(/\[CHIPS:[^\]]*\]/gi, "");
	t = t.replace(/\[TAGS:[^\]]*\]/gi, "");
	// Markdown
	t = t.replace(/\*\*(.+?)\*\*/g, "$1");
	t = t.replace(/\*(.+?)\*/g, "$1");
	t = t.replace(/`([^`]+)`/g, "$1");
	t = t.replace(/^#+\s+/gm, "");
	// Артикулы (пример: AWS-1234, АВ-2.5, ВВГнг 3х2.5) — пропускаем буквенно-цифровые с дефисами
	t = t.replace(/\b[A-ZА-Я]{2,}[-–]\d+[A-ZА-Я0-9-]*/g, "артикул");
	// Маркированные списки
	t = t.replace(/^[\-•*]\s+/gm, "");
	// Двойные пробелы и переводы строк
	t = t.replace(/\s+\n/g, "\n").replace(/\n{2,}/g, ". ").replace(/\s{2,}/g, " ");
	// Обрезаем до ~600 символов — длиннее в голосовом диалоге не читаем
	if (t.length > 600) {
		const cut = t.slice(0, 600);
		const lastDot = cut.lastIndexOf(".");
		t = (lastDot > 200 ? cut.slice(0, lastDot + 1) : cut + "…");
	}
	return t.trim();
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

// Прервать любое текущее озвучивание (кнопка стоп).
export function cancelSpeech() {
	if (typeof window !== "undefined" && window.speechSynthesis) {
		window.speechSynthesis.cancel();
	}
}

export function isSpeechSupported() {
	return typeof window !== "undefined" && !!window.speechSynthesis;
}
