<script>
	import { onMount, onDestroy } from "svelte";
	import { Check, Play, X, User, UserRound } from "lucide-svelte";
	import {
		getRussianVoices,
		getCurrentGender,
		pickBestVoice,
		setVoiceByName,
		previewVoice,
		cancelSpeech,
	} from "$lib/ai/speech.js";
	import * as haptics from "$lib/utils/haptics.js";

	// Bottom-sheet: 2 большие кнопки «Мужской / Женский» с превью.
	// Под капотом выбираем лучший доступный голос соответствующего пола (Yuri,
	// Milena, Microsoft Pavel и т.п.). Если в системе нет нужного пола —
	// показываем грей-кнопку с пометкой что недоступно.

	let { onclose, onchange } = $props();

	let currentGender = $state("unknown");
	let availableMale = $state(null);
	let availableFemale = $state(null);
	let previewing = $state(""); // "male" | "female" | ""

	function refresh() {
		availableMale = pickBestVoice("male");
		availableFemale = pickBestVoice("female");
		// Если pickBestVoice вернул не того пола (нет в системе) — обнуляем
		if (availableMale && availableMale.gender !== "male") availableMale = null;
		if (availableFemale && availableFemale.gender !== "female") availableFemale = null;
		currentGender = getCurrentGender();
	}

	onMount(() => {
		refresh();
		// Голоса могут грузиться асинхронно
		setTimeout(refresh, 300);
		const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
		if (synth) synth.addEventListener?.("voiceschanged", refresh);
		return () => synth?.removeEventListener?.("voiceschanged", refresh);
	});

	onDestroy(() => cancelSpeech());

	function pick(gender) {
		const voice = gender === "male" ? availableMale : availableFemale;
		if (!voice) return;
		haptics.success();
		setVoiceByName(voice.name);
		currentGender = gender;
		onchange?.(voice.name);
	}

	function preview(gender, e) {
		e.stopPropagation();
		const voice = gender === "male" ? availableMale : availableFemale;
		if (!voice) return;
		haptics.tap();
		if (previewing === gender) {
			cancelSpeech();
			previewing = "";
			return;
		}
		previewing = gender;
		previewVoice(voice.name);
		setTimeout(() => {
			if (previewing === gender) previewing = "";
		}, 4500);
	}

	function close() {
		cancelSpeech();
		onclose?.();
	}
</script>

<!-- Полный фуллскрин с blurred backdrop — без <dialog>, надёжнее в Svelte 5 -->
<div class="vp-root" role="dialog" aria-modal="true" aria-label="Выбор голоса">
	<button type="button" class="vp-backdrop" onclick={close} aria-label="Закрыть"></button>
	<div class="vp-sheet">
		<div class="vp-handle" aria-hidden="true"></div>

		<div class="vp-header">
			<h3 class="vp-title">Голос помощника</h3>
			<button class="vp-close" onclick={close} aria-label="Закрыть">
				<X size={20} />
			</button>
		</div>

		<p class="vp-subtitle">Выберите кто будет вам отвечать</p>

		<div class="vp-options">
			<!-- Мужской -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="vp-option"
				class:selected={currentGender === "male"}
				class:disabled={!availableMale}
				onclick={() => availableMale && pick("male")}
				role="button"
				tabindex={availableMale ? 0 : -1}
				aria-disabled={!availableMale}
				aria-pressed={currentGender === "male"}
				onkeydown={(e) => { if (e.key === "Enter" && availableMale) pick("male"); }}
			>
				<div class="vp-avatar male">
					<User size={36} strokeWidth={2} />
				</div>
				<div class="vp-label">Мужской</div>
				{#if !availableMale}
					<div class="vp-unavailable">Недоступно</div>
				{:else}
					<button
						type="button"
						class="vp-preview-btn"
						class:playing={previewing === "male"}
						onclick={(e) => preview("male", e)}
						aria-label="Прослушать мужской голос"
					>
						<Play size={14} fill={previewing === "male" ? "currentColor" : "none"} />
						{previewing === "male" ? "Стоп" : "Послушать"}
					</button>
				{/if}
				{#if currentGender === "male"}
					<div class="vp-checkmark">
						<Check size={16} />
					</div>
				{/if}
			</div>

			<!-- Женский -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="vp-option"
				class:selected={currentGender === "female"}
				class:disabled={!availableFemale}
				onclick={() => availableFemale && pick("female")}
				role="button"
				tabindex={availableFemale ? 0 : -1}
				aria-disabled={!availableFemale}
				aria-pressed={currentGender === "female"}
				onkeydown={(e) => { if (e.key === "Enter" && availableFemale) pick("female"); }}
			>
				<div class="vp-avatar female">
					<UserRound size={36} strokeWidth={2} />
				</div>
				<div class="vp-label">Женский</div>
				{#if !availableFemale}
					<div class="vp-unavailable">Недоступно</div>
				{:else}
					<button
						type="button"
						class="vp-preview-btn"
						class:playing={previewing === "female"}
						onclick={(e) => preview("female", e)}
						aria-label="Прослушать женский голос"
					>
						<Play size={14} fill={previewing === "female" ? "currentColor" : "none"} />
						{previewing === "female" ? "Стоп" : "Послушать"}
					</button>
				{/if}
				{#if currentGender === "female"}
					<div class="vp-checkmark">
						<Check size={16} />
					</div>
				{/if}
			</div>
		</div>

		{#if !availableMale && !availableFemale}
			<p class="vp-hint">
				В системе нет русских голосов. На iPhone проверьте Настройки → Универсальный
				доступ → Контент вслух → Голоса → Русский → загрузите Milena или Yuri.
			</p>
		{/if}
	</div>
</div>

<style>
	.vp-root {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		animation: vp-fade 0.18s ease-out;
	}
	@keyframes vp-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.vp-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.vp-sheet {
		position: relative;
		background: var(--color-base-100);
		border-radius: 24px 24px 0 0;
		max-width: 480px;
		width: 100%;
		margin: 0 auto;
		padding: 0 16px calc(env(safe-area-inset-bottom, 0px) + 24px);
		box-shadow: 0 -10px 40px -8px rgba(0, 0, 0, 0.3);
		animation: vp-slide 0.22s cubic-bezier(0.32, 0.72, 0, 1);
	}
	@keyframes vp-slide {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	.vp-handle {
		width: 40px;
		height: 4px;
		background: var(--color-base-300);
		border-radius: 9999px;
		margin: 8px auto 12px;
	}
	.vp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 4px;
	}
	.vp-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--color-base-content);
		margin: 0;
	}
	.vp-close {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: var(--color-base-200);
		color: var(--color-base-content);
		border: none;
		cursor: pointer;
	}
	.vp-subtitle {
		font-size: 13px;
		color: var(--color-base-content);
		opacity: 0.6;
		margin: 6px 4px 18px;
	}

	.vp-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.vp-option {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 18px 12px 16px;
		border-radius: 18px;
		background: var(--color-base-200);
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.1s ease, border-color 0.18s ease, background 0.18s ease;
		-webkit-tap-highlight-color: transparent;
	}
	.vp-option:active { transform: scale(0.97); }
	.vp-option.selected {
		border-color: var(--color-primary);
		background: color-mix(in oklch, var(--color-primary) 10%, var(--color-base-100));
	}
	.vp-option.disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.vp-avatar {
		width: 80px;
		height: 80px;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
	}
	.vp-avatar.male {
		background: linear-gradient(135deg, oklch(58% 0.12 240), oklch(48% 0.14 250));
	}
	.vp-avatar.female {
		background: linear-gradient(135deg, oklch(72% 0.16 350), oklch(60% 0.18 340));
	}

	.vp-label {
		font-size: 16px;
		font-weight: 600;
		color: var(--color-base-content);
	}

	.vp-preview-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		border-radius: 9999px;
		background: var(--color-base-100);
		border: 1px solid var(--color-base-300);
		color: var(--color-base-content);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.vp-preview-btn.playing {
		background: var(--color-primary);
		color: var(--color-primary-content);
		border-color: var(--color-primary);
	}

	.vp-unavailable {
		font-size: 11px;
		color: var(--color-base-content);
		opacity: 0.5;
		font-weight: 500;
	}

	.vp-checkmark {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 24px;
		height: 24px;
		border-radius: 9999px;
		background: var(--color-primary);
		color: var(--color-primary-content);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vp-hint {
		margin: 16px 4px 0;
		font-size: 12px;
		color: var(--color-base-content);
		opacity: 0.6;
		line-height: 1.5;
	}
</style>
