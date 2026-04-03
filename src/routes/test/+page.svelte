<script>
	import { onMount } from "svelte";
	import { loadCatalog } from "$lib/data/catalog.js";
	import { formatCatalogForAI } from "$lib/ai/prompt.js";

	let log = $state("Нажми кнопку для теста\n");
	let testing = $state(false);
	let catalogText = $state("тест");

	onMount(async () => {
		try {
			const catalog = await loadCatalog();
			catalogText = formatCatalogForAI(catalog.items);
			addLog("Каталог загружен: " + catalogText.length + " символов");
		} catch (e) {
			addLog("Каталог не загрузился: " + e.message);
		}
	});

	function addLog(msg) {
		log += new Date().toLocaleTimeString() + " " + msg + "\n";
	}

	async function testOptions() {
		addLog("→ OPTIONS запрос...");
		try {
			const r = await fetch("https://api.kokolsk1y.ru/api/chat", { method: "OPTIONS" });
			addLog("← OPTIONS: " + r.status + " " + r.statusText);
			addLog("  CORS: " + r.headers.get("access-control-allow-origin"));
		} catch (e) {
			addLog("✗ OPTIONS ошибка: " + e.message);
		}
	}

	async function testPost() {
		addLog("→ POST запрос (stream:false)...");
		try {
			const r = await fetch("https://api.kokolsk1y.ru/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "привет", catalog: catalogText, stream: false })
			});
			addLog("← POST: " + r.status + " " + r.statusText);
			addLog("  Content-Type: " + r.headers.get("content-type"));
			addLog("  CORS: " + r.headers.get("access-control-allow-origin"));
			const text = await r.text();
			addLog("  Body: " + text.slice(0, 200));
		} catch (e) {
			addLog("✗ POST ошибка: " + e.name + ": " + e.message);
		}
	}

	async function testStream() {
		addLog("→ POST запрос (stream:true)...");
		try {
			const r = await fetch("https://api.kokolsk1y.ru/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "привет", catalog: catalogText, stream: true })
			});
			addLog("← Stream: " + r.status + " " + r.statusText);
			const reader = r.body.getReader();
			const decoder = new TextDecoder();
			let chunks = 0;
			let totalBytes = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) { addLog("  Stream DONE после " + chunks + " chunks, " + totalBytes + " bytes"); break; }
				chunks++;
				totalBytes += value.length;
				if (chunks <= 3) addLog("  Chunk " + chunks + ": " + decoder.decode(value).slice(0, 80));
				if (chunks === 4) addLog("  ...(остальные chunks скрыты)");
			}
		} catch (e) {
			addLog("✗ Stream ошибка: " + e.name + ": " + e.message);
		}
	}

	async function runAll() {
		testing = true;
		log = "";
		await testOptions();
		await testPost();
		await testStream();
		addLog("=== ТЕСТЫ ЗАВЕРШЕНЫ ===");
		testing = false;
	}
</script>

<div class="p-4 max-w-lg mx-auto">
	<h1 class="text-xl font-bold mb-4">API Диагностика</h1>
	<button class="btn btn-primary btn-block mb-4" onclick={runAll} disabled={testing}>
		{testing ? "Тестирую..." : "Запустить все тесты"}
	</button>
	<pre class="bg-base-300 p-3 rounded-lg text-xs whitespace-pre-wrap overflow-auto max-h-[70vh]">{log}</pre>
</div>
