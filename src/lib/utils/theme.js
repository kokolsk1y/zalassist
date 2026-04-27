// Управление темой: "light" | "dark"
// При первом запуске берём prefers-color-scheme. Дальше — выбор пользователя.
// Сохраняем в localStorage. Применяем через data-theme на <html>.

const KEY = "zalassist-theme";
const LIGHT = "electrocentr";
const DARK = "electrocentr-dark";

// Возвращает текущую UI-настройку: "light" | "dark"
export function getThemeMode() {
	if (typeof window === "undefined") return "light";
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === "light" || saved === "dark") return saved;
		// Первый запуск — следуем системе
		if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
		return "light";
	} catch {
		return "light";
	}
}

// Применить тему в DOM
export function applyTheme() {
	if (typeof document === "undefined") return;
	const mode = getThemeMode();
	document.documentElement.setAttribute("data-theme", mode === "dark" ? DARK : LIGHT);
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute("content", mode === "dark" ? "#0F1F3F" : "#1E3A6E");
}

// Изменить тему (вызывается из переключателя)
export function setThemeMode(mode) {
	if (mode !== "light" && mode !== "dark") return;
	try { localStorage.setItem(KEY, mode); } catch {}
	applyTheme();
}

// Слушать системные изменения — но только если пользователь не выбирал руками.
// После первого тапа на toggle — игнорируем системные изменения (выбор приоритетней).
export function watchSystemTheme() {
	if (typeof window === "undefined") return () => {};
	const mq = window.matchMedia("(prefers-color-scheme: dark)");
	const handler = () => {
		try {
			const saved = localStorage.getItem(KEY);
			// Если ничего не сохранено — следуем системе. Иначе выбор пользователя приоритетней.
			if (!saved) applyTheme();
		} catch {}
	};
	mq.addEventListener?.("change", handler);
	return () => mq.removeEventListener?.("change", handler);
}
