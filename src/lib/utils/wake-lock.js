// Screen Wake Lock API — экран не гаснет, пока активен лок.
// Используется когда клиент держит карточку товара/подбор открытыми и идёт
// к консультанту: телефон не блокируется, не нужно повторно разблокировать.
// Поддержка: Chrome 84+, Safari 16.4+, Edge — есть. Старые браузеры — нет.
//
// Важно: Wake Lock автоматически отпускается когда вкладка/PWA уходит в фон,
// поэтому при возврате на страницу нужно перезапросить (документоVisibilityChange).

let _sentinel = null;

export function isWakeLockSupported() {
	return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export async function requestWakeLock() {
	if (!isWakeLockSupported()) return false;
	try {
		_sentinel = await navigator.wakeLock.request("screen");
		_sentinel.addEventListener("release", () => {
			_sentinel = null;
		});
		return true;
	} catch {
		_sentinel = null;
		return false;
	}
}

export async function releaseWakeLock() {
	if (!_sentinel) return;
	try {
		await _sentinel.release();
	} catch {}
	_sentinel = null;
}

// Удобная обёртка: держит экран бодрым ВНУТРИ Svelte компонента,
// автоматически перезапрашивая лок при возврате из фона.
// Возвращает функцию отмены — вызывай в onDestroy.
export function keepScreenAwake() {
	if (!isWakeLockSupported()) return () => {};

	let stopped = false;

	const onVisibility = () => {
		if (!stopped && document.visibilityState === "visible" && !_sentinel) {
			requestWakeLock();
		}
	};

	requestWakeLock();
	document.addEventListener("visibilitychange", onVisibility);

	return () => {
		stopped = true;
		document.removeEventListener("visibilitychange", onVisibility);
		releaseWakeLock();
	};
}
