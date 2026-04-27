// Toast-стор для всплывающих уведомлений.
// Поддерживает 3 типа: "success" | "error" | "info" — Toast.svelte показывает
// разные иконки и цвета для каждого.
//
// Опциональный actionLabel — если задан, Toast показывает кликабельный текст
// и при тапе вызывает actionFn. Пример: «Добавлено в список» с переходом в корзину.

let message = $state("");
let type = $state("success");
let visible = $state(false);
let actionLabel = $state("");
let actionFn = null;
let timer = null;

function setVisible(text, t, duration, action) {
	message = text;
	type = t;
	visible = true;
	actionLabel = action?.label || "";
	actionFn = action?.onClick || null;
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		visible = false;
		actionLabel = "";
		actionFn = null;
		timer = null;
	}, duration);
}

export const toast = {
	get message() { return message; },
	get type() { return type; },
	get visible() { return visible; },
	get actionLabel() { return actionLabel; },

	// Совместимость со старым API: toast.show("текст") без типа = success
	show(text, duration = 2500) {
		setVisible(text, "success", duration, null);
	},
	success(text, opts = {}) {
		const { duration = 2500, action = null } = opts;
		setVisible(text, "success", duration, action);
	},
	error(text, opts = {}) {
		const { duration = 4000, action = null } = opts;
		setVisible(text, "error", duration, action);
	},
	info(text, opts = {}) {
		const { duration = 2500, action = null } = opts;
		setVisible(text, "info", duration, action);
	},
	hide() {
		visible = false;
		actionLabel = "";
		actionFn = null;
		if (timer) { clearTimeout(timer); timer = null; }
	},
	triggerAction() {
		if (actionFn) {
			const fn = actionFn;
			toast.hide();
			fn();
		} else {
			toast.hide();
		}
	},
};
