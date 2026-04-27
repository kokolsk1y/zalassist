// Toast-стор для всплывающих уведомлений.
// Поддерживает 3 типа: "success" | "error" | "info" — Toast.svelte показывает
// разные иконки и цвета для каждого. Длительность по умолчанию 2.5 сек.

let message = $state("");
let type = $state("success");
let visible = $state(false);
let timer = null;

function setVisible(text, t, duration) {
	message = text;
	type = t;
	visible = true;
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		visible = false;
		timer = null;
	}, duration);
}

export const toast = {
	get message() { return message; },
	get type() { return type; },
	get visible() { return visible; },

	// Совместимость со старым API: toast.show("текст") без типа = success
	show(text, duration = 2500) {
		setVisible(text, "success", duration);
	},
	success(text, duration = 2500) {
		setVisible(text, "success", duration);
	},
	error(text, duration = 4000) {
		setVisible(text, "error", duration);
	},
	info(text, duration = 2500) {
		setVisible(text, "info", duration);
	},
	hide() {
		visible = false;
		if (timer) { clearTimeout(timer); timer = null; }
	},
};
