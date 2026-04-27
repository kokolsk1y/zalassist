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
		primeSpeech,
	} from "$lib/ai/speech.js";
	import * as haptics from "$lib/utils/haptics.js";

	// Bottom-sheet: 2 большие кнопки «Мужской / Женский» с превью.
	// Обе плашки видны ВСЕГДА — даже если в системе нет голоса какого-то пола,
	// вызовем системный default. Лучше «попытка с дефолтным голосом» чем
	// «недоступно» — пользователь должен иметь выбор всегда.

	let { onclose, onchange } = $props();

	let currentGender = $state("unknown");
	let maleVoiceName = $state(null);   // имя выбранного мужского голоса
	let femaleVoiceName = $state(null); // имя выбранного женского голоса
	let previewing = $state(""); // "male" | "female" | ""

	function refresh() {
		const all = getRussianVoices();
		const males = all.filter((v) => v.gender === "male");
		const females = all.filter((v) => v.gender === "female");
		// Берём явно мужской/женский если есть. Иначе — default или первый из всех
		// (на iPhone русские голоса обычно загружены, на Android может быть только один).
		maleVoiceName = (males.find((v) => v.default) || males[0] || all.find((v) => v.default) || all[0])?.name || null;
		femaleVoiceName = (females.find((v) => v.default) || females[0] || all.find((v) => v.default) || all[0])?.name || null;
		currentGender = getCurrentGender();
	}

	onMount(() => {
		// Pre-warm SpeechSynthesis — на iOS это критично для подгрузки голосов
		primeSpeech();
		refresh();
		// Голоса часто грузятся асинхронно — пробуем ещё несколько раз
		const t1 = setTimeout(refresh, 300);
		const t2 = setTimeout(refresh, 1000);
		const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
		synth?.addEventListener?.("voiceschanged", refresh);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			synth?.removeEventListener?.("voiceschanged", refresh);
		};
	});

	onDestroy(() => cancelSpeech());

	function pick(gender) {
		const name = gender === "male" ? maleVoiceName : femaleVoiceName;
		haptics.success();
		if (name) {
			setVoiceByName(name);
		}
		currentGender = gender;
		onchange?.(name);
	}

	function preview(gender, e) {
		e.stopPropagation();
		const name = gender === "male" ? maleVoiceName : femaleVoiceName;
		haptics.tap();
		if (previewing === gender) {
			cancelSpeech();
			previewing = "";
			return;
		}
		previewing = gender;
		// Если конкретного голоса нет — previewVoice("") сыграет системным default
		previewVoice(name || "");
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
				onclick={() => pick("male")}
				role="button"
				tabindex="0"
				aria-pressed={currentGender === "male"}
				onkeydown={(e) => { if (e.key === "Enter") pick("male"); }}
			>
				<div class="vp-avatar male">
					<User size={36} strokeWidth={2} />
				</div>
				<div class="vp-label">Мужской</div>
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
				onclick={() => pick("female")}
				role="button"
				tabindex="0"
				aria-pressed={currentGender === "female"}
				onkeydown={(e) => { if (e.key === "Enter") pick("female"); }}
			>
				<div class="vp-avatar female">
					<UserRound size={36} strokeWidth={2} />
				</div>
				<div class="vp-label">Женский</div>
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
				{#if currentGender === "female"}
					<div class="vp-checkmark">
						<Check size={16} />
					</div>
				{/if}
			</div>
		</div>
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

</style>
