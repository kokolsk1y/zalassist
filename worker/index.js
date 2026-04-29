// ZalAssist OpenRouter egress proxy
//
// Назначение: тонкий passthrough к OpenRouter с глобального egress IP Cloudflare.
// Архитектура: PWA → Yandex CF (российский ingress, доступен без VPN) → этот Worker
// → OpenRouter. Yandex CF дальше OpenRouter не дотягивается (egress РФ → блок),
// поэтому всю генерацию проксируем сюда.
//
// Никакой бизнес-логики тут нет — prompt-сборка, выбор модели, fallback-цепочка,
// time-context живут в Yandex Function. Worker только: проверяет shared secret,
// делает fetch к OpenRouter, возвращает ответ.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, X-Proxy-Token",
};

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS, "Content-Type": "application/json" },
	});
}

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS });
		}

		// Health-check для отладки связности — GET без авторизации
		if (request.method === "GET") {
			return jsonResponse({ ok: true, service: "zalassist-openrouter-proxy" });
		}

		if (request.method !== "POST") {
			return jsonResponse({ error: "Method not allowed" }, 405);
		}

		// Shared-secret защита: только наш Yandex CF знает PROXY_TOKEN.
		// Без неё любой может анонимно жечь наш OpenRouter-ключ.
		const token = request.headers.get("X-Proxy-Token");
		if (!env.PROXY_TOKEN || token !== env.PROXY_TOKEN) {
			return jsonResponse({ error: "Unauthorized" }, 401);
		}

		let body;
		try {
			body = await request.json();
		} catch {
			return jsonResponse({ error: "Invalid JSON" }, 400);
		}

		// Внутренний таймаут — оставляем 50s. Worker free tier даёт 30s wall-clock,
		// но fetch к external host не считается за CPU. На практике OpenRouter
		// отвечает за 1-5s.
		const controller = new AbortController();
		const upstreamTimeout = setTimeout(() => controller.abort(), 50000);

		const t0 = Date.now();
		let upstreamResponse;
		try {
			upstreamResponse = await fetch(OPENROUTER_URL, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "https://kokolsk1y.github.io/zalassist/",
					"X-Title": "ZalAssist",
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} catch (e) {
			clearTimeout(upstreamTimeout);
			const isAbort = e && e.name === "AbortError";
			console.log(`[proxy] ${isAbort ? "timeout" : "fetch_error"}: ${Date.now() - t0}ms ${e && e.message}`);
			return jsonResponse(
				{ error: isAbort ? "OpenRouter не ответил вовремя" : "Не удалось подключиться к OpenRouter" },
				504,
			);
		}
		clearTimeout(upstreamTimeout);

		// Проксируем тело и статус как есть. Yandex CF разберётся со структурой
		// (data.choices[0].message.content). При not-ok возвращаем 502.
		const text = await upstreamResponse.text();
		console.log(`[proxy] ${upstreamResponse.status}: ${Date.now() - t0}ms, ${text.length}b`);

		if (!upstreamResponse.ok) {
			return new Response(
				JSON.stringify({ error: "ИИ-сервис временно недоступен", status: upstreamResponse.status, detail: text.slice(0, 500) }),
				{ status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
			);
		}

		return new Response(text, {
			status: 200,
			headers: { ...CORS, "Content-Type": "application/json" },
		});
	},
};
