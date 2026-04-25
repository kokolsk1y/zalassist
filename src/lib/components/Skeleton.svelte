<script>
	let { count = 3, variant = "card" } = $props();
</script>

<div class="space-y-2">
	{#each Array(count) as _, i}
		{#if variant === "card"}
			<div class="flex gap-3 bg-base-100 rounded-xl shadow-sm p-3">
				<div class="w-20 h-20 rounded-lg shimmer flex-shrink-0"></div>
				<div class="flex-1 min-w-0 flex flex-col justify-between">
					<div>
						<div class="h-4 shimmer rounded w-4/5"></div>
						<div class="h-4 shimmer rounded w-3/5 mt-1.5"></div>
						<div class="h-3 shimmer rounded w-1/3 mt-2"></div>
					</div>
					<div class="flex items-center justify-between mt-2">
						<div class="h-5 shimmer rounded w-20"></div>
						<div class="h-11 w-11 rounded-full shimmer"></div>
					</div>
				</div>
			</div>
		{:else if variant === "line"}
			<div class="h-4 shimmer rounded" style="width: {70 + (i * 7) % 25}%"></div>
		{:else if variant === "chip"}
			<div class="inline-block h-8 w-24 rounded-full shimmer mr-2"></div>
		{/if}
	{/each}
</div>

<style>
	.shimmer {
		background: linear-gradient(
			90deg,
			rgba(0, 0, 0, 0.06) 0%,
			rgba(0, 0, 0, 0.12) 50%,
			rgba(0, 0, 0, 0.06) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite linear;
	}
	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
