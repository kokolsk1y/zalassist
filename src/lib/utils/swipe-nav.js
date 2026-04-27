// Свайп влево/вправо для навигации между основными разделами.
// Touch events — работает идентично на всех браузерах (Chrome, Safari, Firefox,
// Yandex Browser на Android и iOS — везде через единый Pointer/Touch Events).
//
// Принцип:
//   - Слушаем pointerdown на window, накапливаем дельту до pointerup.
//   - Если |dx| > threshold И |dx| > |dy| × 1.5 (горизонтальный жест) → переход.
//   - Игнорируем: если открыта модалка/диалог, текстовый ввод в фокусе, первые 30px от края.
//
// Возвращает функцию-отписку (для onMount → onDestroy).

const SWIPE_THRESHOLD = 70; // px — минимальная дельта для срабатывания
const HORIZ_RATIO = 1.5; // dx должно быть в N раз больше dy
const EDGE_GUARD = 30; // px от края экрана — там системные жесты iOS «назад в Safari»

export function attachSwipeNav({ onLeft, onRight, isAllowed = () => true } = {}) {
	if (typeof window === "undefined") return () => {};

	let startX = 0;
	let startY = 0;
	let tracking = false;

	function onStart(e) {
		// Только основной палец (не multi-touch — оставляем pinch-zoom фото)
		if (e.pointerType === "mouse" && e.button !== 0) return;
		if (!isAllowed()) return;

		// В фокусе ввод — пользователь печатает или редактирует, не дёргаем
		const active = document.activeElement;
		if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;

		// Открыта модалка/диалог — не перехватываем (свайп нужен для закрытия модалки изнутри)
		if (document.querySelector("dialog[open], .modal[open]")) return;

		// Свайп от самой кромки экрана = системный «назад» на iOS — пропускаем
		if (e.clientX < EDGE_GUARD || e.clientX > window.innerWidth - EDGE_GUARD) return;

		startX = e.clientX;
		startY = e.clientY;
		tracking = true;
	}

	function onEnd(e) {
		if (!tracking) return;
		tracking = false;
		const dx = e.clientX - startX;
		const dy = Math.abs(e.clientY - startY);

		// Горизонтальное намерение должно быть выраженным (иначе это скролл)
		if (Math.abs(dx) < SWIPE_THRESHOLD) return;
		if (Math.abs(dx) < dy * HORIZ_RATIO) return;

		// Свайп влево (палец двигался влево) → следующий раздел
		// Свайп вправо (палец двигался вправо) → предыдущий раздел
		if (dx < 0) onLeft?.();
		else onRight?.();
	}

	function onCancel() { tracking = false; }

	window.addEventListener("pointerdown", onStart);
	window.addEventListener("pointerup", onEnd);
	window.addEventListener("pointercancel", onCancel);

	return () => {
		window.removeEventListener("pointerdown", onStart);
		window.removeEventListener("pointerup", onEnd);
		window.removeEventListener("pointercancel", onCancel);
	};
}
