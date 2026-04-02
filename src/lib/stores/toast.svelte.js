let message = $state("");
let visible = $state(false);
let timer = null;

export const toast = {
	get message() { return message; },
	get visible() { return visible; },

	show(text, duration = 2000) {
		message = text;
		visible = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			visible = false;
			timer = null;
		}, duration);
	}
};
