<script>
	import { onMount } from "svelte";
	import { Sun, Moon, MonitorSmartphone } from "lucide-svelte";
	import { getThemeMode, setThemeMode } from "$lib/utils/theme.js";
	import * as haptics from "$lib/utils/haptics.js";

	// Циклический переключатель темы: auto → light → dark → auto
	// Иконка отражает текущий режим. Понятно что будет дальше — текстовая подпись опционально.

	let mode = $state("auto");

	onMount(() => {
		mode = getThemeMode();
	});

	function cycle() {
		haptics.tap();
		const next = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
		mode = next;
		setThemeMode(next);
	}

	let label = $derived(
		mode === "auto" ? "Авто" :
		mode === "light" ? "Свет" :
		"Тьма"
	);
</script>

<button
	class="theme-toggle"
	onclick={cycle}
	aria-label="Сменить тему: текущая {label}"
	title="Тема: {label} (тап чтобы переключить)"
>
	{#if mode === "auto"}
		<MonitorSmartphone size={20} />
	{:else if mode === "light"}
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
