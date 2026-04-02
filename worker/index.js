import { buildSystemPrompt } from "./prompts.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
	});
}

export default {
	async fetch(request, env) {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		if (request.method !== "POST") {
			return jsonResponse({ error: "Method not allowed" }, 405);
		}

		// Rate limiting
		const ip = request.headers.get("CF-Connecting-IP") || "unknown";
		try {
			if (env.RATE_LIMITER) {
				const { success } = await env.RATE_LIMITER.limit({ key: ip });
				if (!success) {
					return jsonResponse({ error: "Слишком много запросов. Попробуйте через несколько минут." }, 429);
				}
			}
		} catch {
			// Fallback: пропустить если binding не работает на free tier
		}

		// Parse body
		let body;
		try {
			body = await request.json();
		} catch {
			return jsonResponse({ error: "Invalid JSON" }, 400);
		}

		// Validate message (SEC-01)
		const message = body.message?.trim();
		if (!message || typeof message !== "string") {
			return jsonResponse({ error: "Сообщение обязательно" }, 400);
		}
		if (message.length > 500) {
			return jsonResponse({ error: "Сообщение не должно превышать 500 символов" }, 400);
		}

		// Validate catalog
		const catalog = body.catalog;
		if (!catalog || typeof catalog !== "string") {
			return jsonResponse({ error: "Каталог обязателен" }, 400);
		}

		// Validate and trim history
		let history = Array.isArray(body.history) ? body.history : [];
		if (history.length > 20) {
			history = history.slice(-20);
		}

		// Build messages
		const systemMsg = buildSystemPrompt(catalog);
		const messages = [systemMsg, ...history, { role: "user", content: message }];

		// Fetch OpenRouter
		let response;
		try {
			response = await fetch(OPENROUTER_URL, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "https://kokolsk1y.github.io/zalassist/",
					"X-Title": "ZalAssist"
				},
				body: JSON.stringify({
					model: "anthropic/claude-3.5-haiku",
					messages,
					stream: true,
					max_tokens: 1024,
					temperature: 0.3
				})
			});
		} catch (err) {
			return jsonResponse({ error: "Не удалось подключиться к ИИ-сервису" }, 502);
		}

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			return jsonResponse({ error: "ИИ-сервис временно недоступен", detail: text }, 502);
		}

		// Proxy SSE stream
		return new Response(response.body, {
			status: 200,
			headers: {
				...CORS_HEADERS,
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache"
			}
		});
	}
};
