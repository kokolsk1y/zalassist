<script>
	import { onMount } from "svelte";
	import { Check, Play, X } from "lucide-svelte";
	import { getRussianVoices, getCurrentVoiceName, setVoiceByName, previewVoice, cancelSpeech } from "$lib/ai/speech.js";
	import * as haptics from "$lib/utils/haptics.js";

	// Bottom-sheet для выбора голоса. Показывает только русские голоса
	// доступные в системе (на iOS обычно: Milena, Yuri, Katya; на Android —
	// Google русский TTS + сторонние).
	//
	// Колбэки:
	//   onclose() — пользователь закрыл sheet
	//   onchange(name) — выбран новый голос (для родителя — обновить preview-текст)

	let { onclose, onchange } = $props();

	let voices = $state([]);
	let currentName = $state("");
	let previewing = $state(""); // имя голоса который сейчас проигрывается

	onMount(() => {
		// Голоса могут грузиться асинхронно — попробуем сразу + через 200мс
		const load = () => {
			voices = getRussianVoices();
			currentName = getCurrentVoiceName() || "";
		};
		load();
		setTimeout(load, 200);

		// На некоторых системах список голосов триггерит voiceschanged
		const synth = window.speechSynthesis;
		if (synth) synth.addEventListener("voiceschanged", load);
		return () => {
			synth?.removeEventListener("voiceschanged", load);
			cancelSpeech();
		};
	});

	function pick(voice) {
		haptics.tap();
		setVoiceByName(voice.name);
		currentName = voice.name;
		onchange?.(voice.name);
	}

	function preview(voice, e) {
		e.stopPropagation();
		haptics.tap();
		if (previewing === voice.name) {
			cancelSpeech();
			previewing = "";
			return;
		}
		previewing = voice.name;
		previewVoice(voice.name);
		// Сбросим флаг через 4 секунды (примерная длительность сэмпла)
		setTimeout(() => {
			if (previewing === voice.name) previewing = "";
		}, 4500);
	}

	// Человекочитаемые названия системных голосов
	function prettyName(v) {
		// Apple: "Milena", "Yuri", "Katya"
		// Google: "Google русский"
		// Microsoft: "Microsoft Pavel - Russian (Russia)"
		const n = v.name;
		if (/google/i.test(n)) return "Google " + (n.match(/русск/i) ? "(русский)" : "");
		if (/microsoft\s+(\w+)/i.test(n)) {
			const match = n.match(/microsoft\s+(\w+)/i);
			return "Microsoft " + match[1];
		}
		return n;
	}
</script>

<dialog open class="voice-picker">
	<button class="vp-backdrop" onclick={onclose} aria-label="Закрыть"></button>
	<div class="vp-sheet">
		<div class="vp-handle" aria-hidden="true"></div>
		<div class="vp-header">
			<h3 class="vp-title">Выбрать голос</h3>
			<button class="vp-close" onclick={onclose} aria-label="Закрыть">
				<X size={22} />
			</button>
		</div>

		{#if voices.length === 0}
			<p class="vp-empty">
				Голоса не найдены. На iPhone проверьте Настройки → Универсальный доступ → Контент вслух → Голоса → Русский.
			</p>
		{:else}
			<div class="vp-list">
				{#each voices as v (v.name)}
					{@const isCurrent = v.name === currentName}
					{@const isPlaying = previewing === v.name}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="vp-item"
						class:current={isCurrent}
						onclick={() => pick(v)}
						role="button"
						tabindex="0"
						onkeydown={(e) => { if (e.key === "Enter") pick(v); }}
					>
						<span class="vp-icon">
							{#if isCurrent}
								<Check size={20} />
							{/if}
						</span>
						<span class="vp-name">
							{prettyName(v)}
							<span class="vp-lang">{v.lang}{v.default ? " · по умолчанию" : ""}</span>
						</span>
						<button
							type="button"
							class="vp-preview"
							class:playing={isPlaying}
							onclick={(e) => preview(v, e)}
							aria-label={isPlaying ? "Остановить" : "Проиграть пример"}
						>
							<Play size={16} fill={isPlaying ? "currentColor" : "none"} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</dialog>

<style>
	.voice-picker {
		position: fixed;
		inset: 0;
		z-index: 10000;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		max-width: 100%;
		max-height: 100%;
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
		border: none;
		cursor: default;
		padding: 0;
	}

	.vp-sheet {
		position: relative;
		background: var(--color-base-100);
		border-radius: 20px 20px 0 0;
		max-width: 480px;
		width: 100%;
		margin: 0 auto;
		padding: 0 0 calc(env(safe-area-inset-bottom, 0px) + 12px);
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		animation: vp-slide 0.22s cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 -10px 40px -8px rgba(0, 0, 0, 0.3);
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
		margin: 8px auto 4px;
	}
	.vp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px 12px;
		border-bottom: 1px solid var(--color-base-200);
	}
	.vp-title {
		font-size: 17px;
		font-weight: 600;
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
	.vp-empty {
		padding: 24px;
		text-align: center;
		color: var(--color-base-content);
		opacity: 0.6;
		font-size: 14px;
		line-height: 1.5;
	}
	.vp-list {
		overflow-y: auto;
		padding: 8px 8px 4px;
	}
	.vp-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 12px;
		min-height: 56px;
		border: none;
		background: none;
		text-align: left;
		border-radius: 12px;
		cursor: pointer;
		color: var(--color-base-content);
		transition: background 0.15s ease;
	}
	.vp-item:active { background: var(--color-base-200); }
	.vp-item.current { background: color-mix(in oklch, var(--color-primary) 10%, transparent); }

	.vp-icon {
		width: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
		flex-shrink: 0;
	}
	.vp-name {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 15px;
		font-weight: 500;
	}
	.vp-lang {
		font-size: 12px;
		color: var(--color-base-content);
		opacity: 0.5;
		font-weight: 400;
	}
	.vp-preview {
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
		flex-shrink: 0;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.vp-preview.playing {
		background: var(--color-primary);
		color: var(--color-primary-content);
	}
</style>
