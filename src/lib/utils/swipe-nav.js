// Свайп влево/вправо для навигации между основными разделами.
// Real-time drag: контент следует за пальцем (через CSS-переменную --swipe-dx),
// при отпускании — либо переход на соседний таб, либо откат на 0.
//
// Игнорируется когда:
//   - стартовая точка внутри элемента с горизонтальным скроллом (overflow-x: auto/scroll)
//     или его родителей — там нативный скролл важнее
//   - открыта модалка/диалог
//   - в фокусе input/textarea
//   - стартовая точка в первых 30px от края (системный жест iOS)

const SWIPE_THRESHOLD = 80; // px — нужно проехать чтобы переход
const HORIZ_RATIO = 1.4;    // dx должно быть в N раз больше dy
const EDGE_GUARD = 24;      // px от края — там системные жесты iOS
const MAX_DRAG = 120;       // px — потолок сопротивления (ниже не растягиваем)

function isInsideHorizontalScroll(el) {
	let n = el;
	while (n && n !== document.body) {
		const cs = getComputedStyle(n);
		const ox = cs.overflowX;
		if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth) return true;
		n = n.parentElement;
	}
	return false;
}

export function attachSwipeNav({ onLeft, onRight, isAllowed = () => true } = {}) {
	if (typeof window === "undefined") return () => {};

	let startX = 0;
	let startY = 0;
	let lastX = 0;
	let tracking = false;
	let decided = false; // решили что это горизонтальный жест
	let cancelled = false;

	function setOffset(px) {
		document.documentElement.style.setProperty("--swipe-dx", `${px}px`);
	}
	function clearOffset() {
		document.documentElement.style.removeProperty("--swipe-dx");
	}

	function onDown(e) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		if (!isAllowed()) return;

		const active = document.activeElement;
		if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
		if (document.querySelector("dialog[open], .modal[open]")) return;
		if (e.clientX < EDGE_GUARD || e.clientX > window.innerWidth - EDGE_GUARD) return;

		// Стартовая точка внутри горизонтально-скроллируемого контейнера — там скролл важнее
		const target = e.target;
		if (target && isInsideHorizontalScroll(target)) return;

		startX = e.clientX;
		startY = e.clientY;
		lastX = e.clientX;
		tracking = true;
		decided = false;
		cancelled = false;
	}

	function onMove(e) {
		if (!tracking) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		lastX = e.clientX;

		// Решаем направление пока не зафиксировано
		if (!decided) {
			// Слишком вертикально — это скролл, отменяем
			if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) / HORIZ_RATIO) {
				tracking = false;
				cancelled = true;
				clearOffset();
				return;
			}
			if (Math.abs(dx) > 8) decided = true;
		}

		if (decided) {
			// Сопротивление: чем дальше, тем тяжелее (как iOS)
			const eased = Math.sign(dx) * Math.min(MAX_DRAG, Math.abs(dx) * 0.6);
			setOffset(eased);
		}
	}

	function onUp() {
		if (cancelled) { cancelled = false; return; }
		if (!tracking) return;
		tracking = false;
		const dx = lastX - startX;

		// Анимация-возврат к 0 (даже если переходим — целевая страница пере-рендерится)
		document.documentElement.style.transition = "--swipe-dx 0.18s ease-out";
		clearOffset();
		setTimeout(() => { document.documentElement.style.transition = ""; }, 220);

		if (!decided) return;
		if (Math.abs(dx) < SWIPE_THRESHOLD) return;

		if (dx < 0) onLeft?.();
		else onRight?.();
	}

	function onCancel() {
		tracking = false;
		decided = false;
		cancelled = false;
		clearOffset();
	}

	window.addEventListener("pointerdown", onDown);
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onCancel);

	return () => {
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onCancel);
		clearOffset();
	};
}
