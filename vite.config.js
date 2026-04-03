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
				background_color: "#ffffff",
				theme_color: "#2b7de0",
				lang: "ru",
				icons: [
					{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
					{ src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
					{ src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
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
