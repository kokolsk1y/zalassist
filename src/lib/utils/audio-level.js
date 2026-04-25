// Мониторинг уровня микрофона через AudioContext + AnalyserNode.
// Используется для barge-in: когда ИИ говорит, мы параллельно слушаем
// и при громкости пользователя выше порога — прерываем TTS.
//
// Возвращает функцию остановки. Колбэк onLevel(rms) вызывается ~20 раз/сек.

export async function monitorAudioLevel({ onLevel, onError, threshold = 0.05, onSpeech } = {}) {
	if (typeof window === "undefined") return () => {};
	let stream = null;
	let ctx = null;
	let raf = null;
	let stopped = false;
	let speechFiredAt = 0;
	const SPEECH_DEBOUNCE_MS = 300; // короткие шумы не считаем

	try {
		stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
		});
		const Ctx = window.AudioContext || window.webkitAudioContext;
		ctx = new Ctx();
		const source = ctx.createMediaStreamSource(stream);
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 512;
		source.connect(analyser);
		const buf = new Uint8Array(analyser.fftSize);

		const tick = () => {
			if (stopped) return;
			analyser.getByteTimeDomainData(buf);
			// RMS — корень из среднеквадратичного отклонения от 128 (центр)
			let sum = 0;
			for (let i = 0; i < buf.length; i++) {
				const v = (buf[i] - 128) / 128;
				sum += v * v;
			}
			const rms = Math.sqrt(sum / buf.length);
			onLevel?.(rms);
			if (rms > threshold && Date.now() - speechFiredAt > SPEECH_DEBOUNCE_MS) {
				speechFiredAt = Date.now();
				onSpeech?.(rms);
			}
			raf = requestAnimationFrame(tick);
		};
		tick();
	} catch (e) {
		onError?.(e?.name || "error");
		return () => {};
	}

	return () => {
		stopped = true;
		if (raf) cancelAnimationFrame(raf);
		try { ctx?.close(); } catch {}
		stream?.getTracks().forEach((t) => t.stop());
	};
}
