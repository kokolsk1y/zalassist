<script>
	import { CheckCircle2, AlertCircle, Info } from "lucide-svelte";
	import { toast } from "$lib/stores/toast.svelte.js";

	// iOS-стиль toast: pill-форма с blur-фоном, иконка слева, slide-down из-за статус-бара.
	// Учитывает safe-area-inset-top — на iPhone с notch/Dynamic Island не перекрывается.
	// Тапнул по плашке = закрыть досрочно.
</script>

{#if toast.visible}
	<button
		type="button"
		class="toast-pill {toast.type}"
		onclick={() => toast.triggerAction()}
		aria-live="polite"
	>
		<span class="toast-icon">
			{#if toast.type === "error"}
				<AlertCircle size={18} />
			{:else if toast.type === "info"}
				<Info size={18} />
			{:else}
				<CheckCircle2 size={18} />
			{/if}
		</span>
		<span class="toast-text">{toast.message}</span>
		{#if toast.actionLabel}
			<span class="toast-action">{toast.actionLabel}</span>
		{/if}
	</button>
{/if}

<style>
	.toast-pill {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		/* Под Dynamic Island/notch — учитываем safe-area + небольшой воздух */
		top: calc(env(safe-area-inset-top, 0px) + 12px);
		z-index: 200;

		display: flex;
		align-items: center;
		gap: 8px;
		max-width: calc(100vw - 24px);
		padding: 10px 18px 10px 14px;

		/* Glassmorphism: тёмный полупрозрачный фон + размытие */
		background: color-mix(in oklch, var(--color-base-content) 92%, transparent);
		color: var(--color-base-100);
		backdrop-filter: blur(16px) saturate(180%);
		-webkit-backdrop-filter: blur(16px) saturate(180%);
		border-radius: 9999px;
		border: none;
		box-shadow:
			0 12px 32px -8px rgba(0, 0, 0, 0.35),
			0 0 0 1px color-mix(in oklch, var(--color-base-content) 96%, transparent);

		font-size: 14px;
		font-weight: 500;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;

		animation: toast-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.toast-pill:active {
		transform: translateX(-50%) scale(0.96);
	}

	.toast-text {
		text-overflow: ellipsis;
		overflow: hidden;
		max-width: calc(100vw - 80px);
	}

	.toast-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.toast-action {
		margin-left: 4px;
		padding: 4px 10px;
		border-radius: 9999px;
		background: color-mix(in oklch, var(--color-base-100) 18%, transparent);
		font-size: 13px;
		font-weight: 600;
		color: oklch(78% 0.18 150);
		white-space: nowrap;
		flex-shrink: 0;
	}
	/* Цветовые акценты — у иконки, не у фона (фон одинаково тёмный для read-ability) */
	.toast-pill.success .toast-icon { color: oklch(78% 0.18 150); }
	.toast-pill.error   .toast-icon { color: oklch(72% 0.20 25); }
	.toast-pill.info    .toast-icon { color: oklch(75% 0.16 230); }

	/* Появление — slide-down с лёгким bounce, как iOS Dynamic Island */
	@keyframes toast-in {
		0%   { opacity: 0; transform: translate(-50%, -120%) scale(0.85); }
		60%  { opacity: 1; transform: translate(-50%, 6px) scale(1.02); }
		100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
	}

	/* Уважение к настройке reduced motion — без bounce */
	@media (prefers-reduced-motion: reduce) {
		.toast-pill {
			animation: toast-in-simple 0.18s ease-out;
		}
		@keyframes toast-in-simple {
			from { opacity: 0; }
			to { opacity: 1; }
		}
	}
</style>
