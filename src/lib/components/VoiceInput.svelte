<script>
	import { Mic } from "lucide-svelte";
	import { recognizeOnce, isRecognitionSupported } from "$lib/ai/recognize.js";
	import * as haptics from "$lib/utils/haptics.js";

	let { onResult, size = 20, class: cls = "" } = $props();

	let supported = $state(false);
	let listening = $state(false);
	let session = null;

	$effect(() => {
		if (typeof window !== "undefined") {
			supported = isRecognitionSupported();
		}
	});

	function toggle() {
		if (!supported) return;
		if (listening && session) {
			session.abort();
			session = null;
			listening = false;
			return;
		}
		haptics.tap();
		listening = true;
		session = recognizeOnce({
			onEnd: () => { listening = false; },
		});
		session.promise.then((text) => {
			session = null;
			listening = false;
			if (text) onResult?.(text);
		});
	}
</script>

{#if supported}
	<button
		type="button"
		class="btn btn-ghost btn-circle min-h-[40px] min-w-[40px] {listening ? 'text-error' : 'text-base-content/50'} {cls}"
		onclick={toggle}
		aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
		title={listening ? "Слушаю..." : "Голосовой ввод"}
	>
		{#if listening}
			<div class="relative">
				<Mic {size} />
				<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full animate-pulse"></span>
			</div>
		{:else}
			<Mic {size} />
		{/if}
	</button>
{/if}
