// Управление темой: "auto" (по системе) | "light" | "dark"
// Сохраняем выбор в localStorage. Применяем через data-theme на <html> для daisyUI.

const KEY = "zalassist-theme";
const LIGHT = "electrocentr";
const DARK = "electrocentr-dark";

// Возвращает текущую UI-настройку: "auto" | "light" | "dark"
export function getThemeMode() {
	if (typeof window === "undefined") return "auto";
	try { return localStorage.getItem(KEY) || "auto"; } catch { return "auto"; }
}

// Реальная тема которая применена сейчас: "light" | "dark"
export function getEffectiveTheme() {
	const mode = getThemeMode();
	if (mode === "light") return "light";
	if (mode === "dark") return "dark";
	// "auto" — спрашиваем систему
	if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
		return "dark";
	}
	return "light";
}

// Применить тему в DOM. Вызывается при загрузке и при ручном переключении.
export function applyTheme() {
	if (typeof document === "undefined") return;
	const eff = getEffectiveTheme();
	document.documentElement.setAttribute("data-theme", eff === "dark" ? DARK : LIGHT);
	// Подстраиваем theme-color для системной шапки браузера/строки уведомлений
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute("content", eff === "dark" ? "#0F1F3F" : "#1E3A6E");
}

// Изменить тему (вызывается из переключателя)
export function setThemeMode(mode) {
	if (!["auto", "light", "dark"].includes(mode)) return;
	try { localStorage.setItem(KEY, mode); } catch {}
	applyTheme();
}

// Слушать системные изменения prefers-color-scheme — нужно когда mode="auto"
export function watchSystemTheme() {
	if (typeof window === "undefined") return () => {};
	const mq = window.matchMedia("(prefers-color-scheme: dark)");
	const handler = () => {
		if (getThemeMode() === "auto") applyTheme();
	};
	mq.addEventListener?.("change", handler);
	return () => mq.removeEventListener?.("change", handler);
}
