<script>
	import { Mic, MicOff } from "lucide-svelte";

	let { onResult, size = 20, class: cls = "" } = $props();

	let supported = $state(false);
	let listening = $state(false);
	let recognition = null;

	$effect(() => {
		if (typeof window !== "undefined") {
			supported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
		}
	});

	function toggle() {
		if (!supported) return;
		if (listening) {
			recognition?.stop();
			return;
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		recognition = new SpeechRecognition();
		recognition.lang = "ru-RU";
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		recognition.continuous = false;

		recognition.onstart = () => { listening = true; };

		recognition.onresult = (event) => {
			const text = event.results[0][0].transcript;
			if (text) onResult?.(text);
			listening = false;
		};

		recognition.onerror = () => { listening = false; };
		recognition.onend = () => { listening = false; };

		try {
			recognition.start();
		} catch {
			listening = false;
		}
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
