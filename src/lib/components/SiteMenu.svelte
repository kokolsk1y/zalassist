<script>
	import { ExternalLink, Tag, Truck, RotateCcw, BadgePercent, Info, Phone, X } from "lucide-svelte";
	import * as haptics from "$lib/utils/haptics.js";

	// Bottom-sheet «Полный сайт»: быстрые deep-link на разделы stv39.ru
	// для информации которая не помещается в приложение (акции, доставка,
	// возвраты, дисконтная программа, контакты).

	let { open = false, onclose } = $props();

	const LINKS = [
		{ icon: Tag,         label: "Акции и новинки",      href: "https://stv39.ru/sale/",         color: "#DC2626" },
		{ icon: Truck,       label: "Доставка и оплата",    href: "https://stv39.ru/dostavka/",     color: "#0891B2" },
		{ icon: RotateCcw,   label: "Возвраты и гарантия",  href: "https://stv39.ru/help/",         color: "#7C3AED" },
		{ icon: BadgePercent,label: "Дисконтная программа", href: "https://stv39.ru/diskont/",      color: "#D97706" },
		{ icon: Info,        label: "О магазине",           href: "https://stv39.ru/about/",        color: "#1E3A6E" },
		{ icon: Phone,       label: "Контакты",             href: "https://stv39.ru/contacts/",     color: "#059669" },
	];

	function tap(href) {
		haptics.tap();
		// Открываем в новой вкладке: пользователь не выходит из PWA
		window.open(href, "_blank", "noopener,noreferrer");
	}
</script>

{#if open}
	<div class="sm-root" role="dialog" aria-modal="true" aria-label="Полный сайт магазина">
		<button type="button" class="sm-backdrop" onclick={() => onclose?.()} aria-label="Закрыть"></button>
		<div class="sm-sheet">
			<div class="sm-handle" aria-hidden="true"></div>
			<div class="sm-header">
				<div>
					<h3 class="sm-title">Полный сайт магазина</h3>
					<p class="sm-sub">stv39.ru — больше информации и сервисов</p>
				</div>
				<button class="sm-close" onclick={() => onclose?.()} aria-label="Закрыть">
					<X size={20} />
				</button>
			</div>

			<a
				class="sm-main"
				href="https://stv39.ru/"
				target="_blank"
				rel="noopener noreferrer"
				onclick={() => haptics.tap()}
			>
				<div class="sm-main-icon">
					<ExternalLink size={22} />
				</div>
				<div class="sm-main-text">
					<div class="sm-main-title">Открыть stv39.ru</div>
					<div class="sm-main-sub">Главная страница сайта</div>
				</div>
			</a>

			<div class="sm-grid">
				{#each LINKS as link}
					<button
						type="button"
						class="sm-link"
						style:--link-color={link.color}
						onclick={() => tap(link.href)}
					>
						<div class="sm-link-icon">
							<link.icon size={20} />
						</div>
						<span class="sm-link-label">{link.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.sm-root {
		position: fixed;
		inset: 0;
		z-index: 9000;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		animation: sm-fade 0.18s ease-out;
	}
	@keyframes sm-fade { from { opacity: 0; } to { opacity: 1; } }

	.sm-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		border: none;
		padding: 0;
		cursor: default;
	}

	.sm-sheet {
		position: relative;
		background: var(--color-base-100);
		border-radius: 24px 24px 0 0;
		max-width: 480px;
		width: 100%;
		margin: 0 auto;
		padding: 0 16px calc(env(safe-area-inset-bottom, 0px) + 24px);
		box-shadow: 0 -10px 40px -8px rgba(0, 0, 0, 0.3);
		animation: sm-slide 0.22s cubic-bezier(0.32, 0.72, 0, 1);
	}
	@keyframes sm-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }

	.sm-handle {
		width: 40px; height: 4px;
		background: var(--color-base-300);
		border-radius: 9999px;
		margin: 8px auto 12px;
	}

	.sm-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 0 4px 16px;
	}
	.sm-title {
		font-size: 17px;
		font-weight: 700;
		color: var(--color-base-content);
		margin: 0;
	}
	.sm-sub {
		font-size: 12px;
		color: var(--color-base-content);
		opacity: 0.6;
		margin: 4px 0 0;
	}
	.sm-close {
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
	}

	.sm-main {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		background: linear-gradient(135deg, var(--color-primary), color-mix(in oklch, var(--color-primary) 70%, black));
		color: white;
		border-radius: 16px;
		text-decoration: none;
		margin-bottom: 12px;
		transition: transform 0.1s ease;
	}
	.sm-main:active { transform: scale(0.98); }
	.sm-main-icon {
		width: 44px; height: 44px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.18);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.sm-main-title {
		font-size: 16px;
		font-weight: 600;
	}
	.sm-main-sub {
		font-size: 12px;
		opacity: 0.85;
	}

	.sm-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.sm-link {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		padding: 14px 12px;
		background: var(--color-base-200);
		border: none;
		border-radius: 14px;
		text-align: left;
		cursor: pointer;
		transition: transform 0.1s ease, background 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}
	.sm-link:active { transform: scale(0.97); }
	.sm-link-icon {
		width: 36px; height: 36px;
		border-radius: 10px;
		background: color-mix(in oklch, var(--link-color) 14%, transparent);
		color: var(--link-color);
		display: flex; align-items: center; justify-content: center;
	}
	.sm-link-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-base-content);
		line-height: 1.3;
	}
</style>
