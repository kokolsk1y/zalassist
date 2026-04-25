<script>
	import { base } from "$app/paths";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import BarcodeScanner from "$lib/components/BarcodeScanner.svelte";
	import { loadCatalog, findByBarcode } from "$lib/data/catalog.js";
	import * as haptics from "$lib/utils/haptics.js";

	onMount(async () => {
		// Прогрев каталога — нужен для findByBarcode
		try { await loadCatalog(); } catch {}
	});

	function handleResult(code) {
		const item = findByBarcode(code);
		if (item) {
			// Найден — переход в карточку (существующий поиск умеет открывать товар по article)
			goto(`${base}/search/?q=${encodeURIComponent(item.article)}`);
		} else {
			// Не найден — отправляем в поиск с самим кодом, fallback по тексту
			haptics.error();
			goto(`${base}/search/?q=${encodeURIComponent(code)}&barcode=1`);
		}
	}

	function handleCancel() {
		history.length > 1 ? history.back() : goto(`${base}/`);
	}
</script>

<svelte:head>
	<title>Сканер штрих-кода — ЭлектроЦентр</title>
</svelte:head>

<BarcodeScanner onresult={handleResult} oncancel={handleCancel} />
