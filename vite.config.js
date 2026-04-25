import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: "autoUpdate",
			manifest: {
				name: "ЭлектроЦентр — Помощник",
				short_name: "ЭлектроЦентр",
				description: "Подбор товаров электротехники в магазине ЭлектроЦентр",
				start_url: "/zalassist/",
				scope: "/zalassist/",
				display: "standalone",
				background_color: "#1E3A6E",
				theme_color: "#1E3A6E",
				lang: "ru",
				orientation: "portrait",
				icons: [
					{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
					{ src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
					{ src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
				],
				// Длинное нажатие на иконку приложения на главном экране → быстрые действия.
				// Поддерживается Android Chrome / Edge; iOS пока игнорирует, но не ломается.
				shortcuts: [
					{
						name: "AI-помощник",
						short_name: "AI",
						description: "Подбор товаров под задачу через диалог",
						url: "/zalassist/chat/",
						icons: [{ src: "pwa-192x192.png", sizes: "192x192" }]
					},
					{
						name: "Поиск",
						short_name: "Поиск",
						description: "Найти товар по артикулу или названию",
						url: "/zalassist/search/",
						icons: [{ src: "pwa-192x192.png", sizes: "192x192" }]
					},
					{
						name: "Готовые комплекты",
						short_name: "Комплекты",
						description: "Готовые наборы под типовые задачи",
						url: "/zalassist/kits/",
						icons: [{ src: "pwa-192x192.png", sizes: "192x192" }]
					}
				]
			},
			workbox: {
				globPatterns: ["client/**/*.{js,css,ico,png,svg,webp,woff,woff2}"],
				navigateFallback: null,
				cleanupOutdatedCaches: true,
				skipWaiting: true,
				clientsClaim: true,
				runtimeCaching: [
					{
						urlPattern: /\/catalog\.json$/,
						handler: "StaleWhileRevalidate",
						options: {
							cacheName: "catalog-cache",
							expiration: { maxAgeSeconds: 86400 }
						}
					}
				]
			}
		})
	]
});
