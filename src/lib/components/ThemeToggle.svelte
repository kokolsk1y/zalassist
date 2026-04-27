<script>
	import { onMount } from "svelte";
	import { Sun, Moon } from "lucide-svelte";
	import { getThemeMode, setThemeMode } from "$lib/utils/theme.js";
	import * as haptics from "$lib/utils/haptics.js";

	// Переключатель тёмной темы — простой toggle: светлая ↔ тёмная.
	// Иконка показывает что СТАНЕТ при тапе (солнце = «переключиться на светлую»,
	// луна = «переключиться на тёмную»).

	let mode = $state("light");

	onMount(() => {
		mode = getThemeMode();
	});

	function toggle() {
		haptics.tap();
		const next = mode === "dark" ? "light" : "dark";
		mode = next;
		setThemeMode(next);
	}
</script>

<button
	class="theme-toggle"
	onclick={toggle}
	aria-label={mode === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
	title={mode === "dark" ? "Светлая тема" : "Тёмная тема"}
>
	{#if mode === "dark"}
		<Sun size={20} />
	{:else}
		<Moon size={20} />
	{/if}
</button>

<style>
	.theme-toggle {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: color-mix(in oklch, var(--color-base-content) 8%, transparent);
		color: var(--color-base-content);
		border: none;
		cursor: pointer;
		transition: background 0.15s ease, transform 0.1s ease;
		-webkit-tap-highlight-color: transparent;
	}
	.theme-toggle:active { transform: scale(0.94); }
	.theme-toggle:hover { background: color-mix(in oklch, var(--color-base-content) 14%, transparent); }
</style>
