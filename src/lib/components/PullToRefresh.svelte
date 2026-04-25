<script>
	import { RefreshCw } from "lucide-svelte";
	import * as haptics from "$lib/utils/haptics.js";

	// Pull-to-refresh: тянешь вниз когда страница уже в самом верху →
	// появляется индикатор → отпускаешь → колбэк onrefresh.
	// Имитирует нативный паттерн iOS/Android. Работает через touch-события.

	let { onrefresh, threshold = 70, children } = $props();

	let dy = $state(0);
	let pulling = $state(false);
	let refreshing = $state(false);
	let armed = $state(false); // true когда перешагнули порог — даём haptic + меняем стиль
	let startY = 0;

	function onTouchStart(e) {
		// Активируем только если страница уже скроллена в самый верх
		if (window.scrollY > 0 || refreshing) return;
		startY = e.touches[0].clientY;
		pulling = true;
		dy = 0;
		armed = false;
	}

	function onTouchMove(e) {
		if (!pulling || refreshing) return;
		const delta = e.touches[0].clientY - startY;
		if (delta <= 0) {
			dy = 0;
			return;
		}
		// Эффект «резинки» — чем дальше тянешь, тем медленнее идёт
		dy = Math.min(140, delta * 0.55);
		const justArmed = dy >= threshold;
		if (justArmed && !armed) {
			armed = true;
			haptics.tap();
		} else if (!justArmed && armed) {
			armed = false;
		}
	}

	async function onTouchEnd() {
		if (!pulling) return;
		pulling = false;
		if (armed && !refreshing) {
			refreshing = true;
			haptics.success();
			try {
				await onrefresh?.();
			} finally {
				refreshing = false;
				dy = 0;
				armed = false;
			}
		} else {
			dy = 0;
			armed = false;
		}
	}
</script>

<svelte:window
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
	ontouchcancel={onTouchEnd}
/>

<!-- Индикатор поверх контента, не сдвигает страницу -->
<div
	class="ptr-indicator"
	class:visible={dy > 8 || refreshing}
	style:transform="translateY({Math.min(dy, 80)}px) rotate({refreshing ? 0 : dy * 4}deg)"
>
	<div class="ptr-circle" class:armed class:refreshing>
		<RefreshCw size={20} class={refreshing ? "animate-spin" : ""} />
	</div>
</div>

{@render children?.()}

<style>
	.ptr-indicator {
		position: fixed;
		top: env(safe-area-inset-top, 0px);
		left: 50%;
		margin-left: -22px;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 60;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.ptr-indicator.visible {
		opacity: 1;
	}
	.ptr-circle {
		width: 36px;
		height: 36px;
		border-radius: 9999px;
		background: var(--color-base-100);
		color: var(--color-base-content);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: background 0.2s ease, color 0.2s ease;
	}
	.ptr-circle.armed,
	.ptr-circle.refreshing {
		background: var(--color-primary);
		color: var(--color-primary-content);
	}
</style>
