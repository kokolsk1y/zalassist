/**
 * Копировать текст в буфер обмена.
 * Fallback через textarea для iOS Safari и старых браузеров.
 * ВАЖНО: вызывать синхронно из onclick (не после await) для iOS.
 */
export async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// Fallback для iOS Safari
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.style.position = "fixed";
		textarea.style.left = "-9999px";
		textarea.style.top = "-9999px";
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		try {
			document.execCommand("copy");
			return true;
		} catch {
			return false;
		} finally {
			document.body.removeChild(textarea);
		}
	}
}
