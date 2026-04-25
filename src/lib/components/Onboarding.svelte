<script>
	import { onMount } from "svelte";
	import { MessageSquare, ScanLine, Headphones, ChevronRight } from "lucide-svelte";
	import * as haptics from "$lib/utils/haptics.js";

	// Onboarding — 3 экрана-объяснения при ПЕРВОМ запуске.
	// Хранит факт показа в localStorage; повторно не появляется.
	// Свайп влево/вправо для перелистывания, кнопки внизу.

	const KEY = "zalassist-onboarding-seen-v1";

	let visible = $state(false);
	let step = $state(0);
	let dragX = $state(0);
	let dragging = $state(false);
	let startX = 0;

	const steps = [
		{
			icon: MessageSquare,
			color: "var(--color-primary)",
			title: "AI-помощник",
			desc: "Опишите задачу — соберём список товаров. Не нужно знать артикулы, помощник сам спросит и подскажет.",
			example: "«Проводка в гараже 30 квадратов, ввод 220В»",
		},
		{
			icon: ScanLine,
			color: "var(--color-secondary)",
			title: "Сканер штрих-кода",
			desc: "В зале наведите камеру на упаковку — сразу откроется карточка товара с ценой, наличием и аналогами.",
			example: "Кнопка-сканер по центру нижней панели",
		},
		{
			icon: Headphones,
			color: "var(--color-info)",
			title: "Голосовой режим",
			desc: "Можно говорить вслух — помощник отвечает голосом. Удобно когда руки заняты.",
			example: "Иконка 🎧 в шапке чата",
		},
	];

	onMount(() => {
		try {
			if (!localStorage.getItem(KEY)) {
				// Лёгкая задержка чтобы первый рендер не был отвлечён overlay
				setTimeout(() => { visible = true; }, 600);
			}
		} catch {}
	});

	function close() {
		try { localStorage.setItem(KEY, "1"); } catch {}
		visible = false;
		haptics.tap();
	}

	function next() {
		haptics.tap();
		if (step < steps.length - 1) {
			step++;
		} else {
			close();
		}
	}

	function goTo(i) {
		haptics.tap();
		step = i;
	}

	// Свайп влево/вправо для перелистывания
	function onTouchStart(e) {
		startX = e.touches[0].clientX;
		dragging = true;
		dragX = 0;
	}
	function onTouchMove(e) {
		if (!dragging) return;
		dragX = e.touches[0].clientX - startX;
	}
	function onTouchEnd() {
		if (!dragging) return;
		dragging = false;
		const TH = 60;
		if (dragX < -TH && step < steps.length - 1) step++;
		else if (dragX > TH && step > 0) step--;
		dragX = 0;
	}
</script>

{#if visible}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div class="onb-root" role="dialog" aria-modal="true" aria-label="Знакомство с приложением">
		<button
			class="skip-btn"
			onclick={close}
			aria-label="Пропустить"
		>Пропустить</button>

		<div
			class="onb-stage"
			ontouchstart={onTouchStart}
			ontouchmove={onTouchMove}
			ontouchend={onTouchEnd}
		>
			<div class="onb-track" style:transform="translateX(calc({-step * 100}% + {dragX}px))">
				{#each steps as s, i}
					{@const Icon = s.icon}
					<div class="onb-card">
						<div class="onb-icon" style:background={s.color}>
							<Icon size={48} strokeWidth={2} />
						</div>
						<h2 class="onb-title">{s.title}</h2>
						<p class="onb-desc">{s.desc}</p>
						<div class="onb-example">{s.example}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="onb-bottom">
			<div class="onb-dots">
				{#each steps as _, i}
					<button
						class="onb-dot"
						class:active={i === step}
						onclick={() => goTo(i)}
						aria-label={`Шаг ${i + 1} из ${steps.length}`}
					></button>
				{/each}
			</div>
			<button class="onb-next" onclick={next}>
				{step < steps.length - 1 ? "Дальше" : "Поехали"}
				<ChevronRight size={20} />
			</button>
		</div>
	</div>
{/if}

<style>
	.onb-root {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: var(--color-base-100);
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		animation: fade-in 0.25s ease-out;
	}
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.skip-btn {
		position: absolute;
		top: calc(env(safe-area-inset-top, 0px) + 12px);
		right: 16px;
		padding: 8px 14px;
		font-size: 14px;
		font-weight: 500;
		color: var(--color-base-content);
		opacity: 0.6;
		background: none;
		border: none;
		cursor: pointer;
		z-index: 2;
	}

	.onb-stage {
		flex: 1;
		overflow: hidden;
		display: flex;
		align-items: center;
	}
	.onb-track {
		display: flex;
		width: 100%;
		transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.onb-card {
		flex: 0 0 100%;
		padding: 0 32px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 16px;
	}
	.onb-icon {
		width: 96px;
		height: 96px;
		border-radius: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		box-shadow: 0 12px 32px -8px color-mix(in oklch, currentColor 30%, transparent);
		margin-bottom: 8px;
	}
	.onb-title {
		font-size: 28px;
		font-weight: 700;
		color: var(--color-base-content);
		line-height: 1.15;
		margin: 0;
	}
	.onb-desc {
		font-size: 16px;
		line-height: 1.5;
		color: var(--color-base-content);
		opacity: 0.7;
		max-width: 380px;
		margin: 0;
	}
	.onb-example {
		font-size: 13px;
		color: var(--color-primary);
		background: color-mix(in oklch, var(--color-primary) 10%, transparent);
		padding: 8px 14px;
		border-radius: 9999px;
		font-weight: 500;
		font-style: italic;
	}

	.onb-bottom {
		padding: 16px 24px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}
	.onb-dots {
		display: flex;
		gap: 8px;
	}
	.onb-dot {
		width: 8px;
		height: 8px;
		border-radius: 9999px;
		background: var(--color-base-300);
		border: none;
		cursor: pointer;
		transition: width 0.25s ease, background 0.25s ease;
		padding: 0;
	}
	.onb-dot.active {
		width: 24px;
		background: var(--color-primary);
	}

	.onb-next {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 52px;
		padding: 0 36px;
		border-radius: 9999px;
		background: var(--color-primary);
		color: var(--color-primary-content);
		font-size: 16px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition: transform 0.1s ease;
		box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--color-primary) 50%, transparent);
	}
	.onb-next:active { transform: scale(0.96); }
</style>
