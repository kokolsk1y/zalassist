// Text-to-speech через браузерный SpeechSynthesis API.
// Качество русского голоса на iOS — хорошее (Siri/Milena), на Android — варьируется.
// На неподдерживаемых браузерах вызовы безопасно игнорируются.

let _voicesLoaded = false;
let _ruVoice = null;

const VOICE_PREF_KEY = "zalassist-voice-name";

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
	// Сохранённый пользователем выбор (если есть)
	let savedName = null;
	try { savedName = localStorage.getItem(VOICE_PREF_KEY); } catch {}
	const saved = savedName ? voices.find((v) => v.name === savedName) : null;
	// Приоритет: сохранённый > ru-RU > содержит "ru" > по имени russian/русск
	_ruVoice = saved
		|| voices.find((v) => v.lang === "ru-RU")
		|| voices.find((v) => v.lang?.startsWith("ru"))
		|| voices.find((v) => /russian|русск/i.test(v.name));
	_voicesLoaded = true;
}

// Эвристика — определить пол голоса по имени.
// Возвращает "male" | "female" | "unknown".
function guessGender(name) {
	const n = String(name).toLowerCase();
	// Известные мужские системные голоса (Apple iOS / Microsoft / Google)
	if (/\b(yuri|alex|alexei|alexey|maxim|pavel|bogdan|nikolay|dmitry|viktor)\b/i.test(name)) return "male";
	// Известные женские
	if (/\b(milena|katya|irina|svetlana|tatyana|elena|natalya|anna|maria|olga|polina|alena|zhenya)\b/i.test(name)) return "female";
	// Microsoft/Google помечают пол в названии
	if (/female|женск/i.test(n)) return "female";
	if (/\bmale\b|мужск/i.test(n)) return "male";
	return "unknown";
}

// Получить список доступных русских голосов с угаданным полом.
export function getRussianVoices() {
	if (typeof window === "undefined" || !window.speechSynthesis) return [];
	ensureVoices();
	const voices = window.speechSynthesis.getVoices();
	return voices
		.filter((v) => v.lang?.startsWith("ru") || /russian|русск/i.test(v.name))
		.map((v) => ({
			name: v.name,
			lang: v.lang,
			default: v.default,
			gender: guessGender(v.name),
		}));
}

// Возвращает один лучший голос указанного пола (для UI «Мужской/Женский»).
// Приоритет: явный gender → default-голос → первый в списке.
export function pickBestVoice(gender) {
	const voices = getRussianVoices();
	if (voices.length === 0) return null;
	const matching = voices.filter((v) => v.gender === gender);
	if (matching.length > 0) {
		return matching.find((v) => v.default) || matching[0];
	}
	// Если такого пола нет в системе — возвращаем default или первый
	return voices.find((v) => v.default) || voices[0];
}

// Текущий пол выбранного голоса
export function getCurrentGender() {
	const name = getCurrentVoiceName();
	if (!name) return "unknown";
	return guessGender(name);
}

// Имя текущего выбранного голоса (для подсветки в UI)
export function getCurrentVoiceName() {
	ensureVoices();
	return _ruVoice?.name || null;
}

// Сменить голос — сохраняем в localStorage и применяем сразу
export function setVoiceByName(name) {
	if (typeof window === "undefined" || !window.speechSynthesis) return false;
	const voices = window.speechSynthesis.getVoices();
	const found = voices.find((v) => v.name === name);
	if (!found) return false;
	_ruVoice = found;
	try { localStorage.setItem(VOICE_PREF_KEY, name); } catch {}
	return true;
}

// Тест-озвучка для preview-кнопки в выборе голоса
export function previewVoice(voiceName, sample = "Привет, я помощник ЭлектроЦентра. Спрашивайте о товарах.") {
	if (typeof window === "undefined" || !window.speechSynthesis) return;
	cancelSpeech();
	const voices = window.speechSynthesis.getVoices();
	const voice = voices.find((v) => v.name === voiceName);
	if (!voice) return;
	const utter = new SpeechSynthesisUtterance(sample);
	utter.voice = voice;
	utter.lang = voice.lang;
	utter.rate = 1.05;
	window.speechSynthesis.speak(utter);
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

// iOS Safari (включая standalone PWA) блокирует первый speak() если он
// не вызван прямо в обработчике user gesture. Чтобы решить это, при
// нажатии на кнопку «Голос» нужно сразу запустить «пустое» высказывание
// — это активирует TTS-канал на текущей сессии. Дальше speak() работает
// в любой момент, в том числе после async network-вызовов.
export function primeSpeech() {
	if (!isSpeechSupported()) return;
	try {
		const synth = window.speechSynthesis;
		// Резюмируем (на iOS Safari speech synthesis может быть приостановлен)
		if (synth.paused) synth.resume();
		// Очень короткое и тихое высказывание для активации канала
		const utter = new SpeechSynthesisUtterance(" ");
		utter.volume = 0;
		utter.rate = 10;
		synth.speak(utter);
	} catch {}
}

// Определяем платформу — нужно для решений типа "на iOS не запускать
// barge-in потому что getUserMedia глушит динамик через earpiece".
export function isIOS() {
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent;
	return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
