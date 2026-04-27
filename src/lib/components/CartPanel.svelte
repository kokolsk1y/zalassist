<script>
	import { useCart } from "$lib/stores/cart.svelte.js";
	import { shareText, canNativeShare } from "$lib/utils/share.js";
	import * as haptics from "$lib/utils/haptics.js";
	import { X, Minus, Plus, Trash2, Check, Send, Share2 } from "lucide-svelte";

	let { open, onclose } = $props();
	let shareState = $state(""); // "" | "shared" | "copied"
	let dialog;
	const cart = useCart();
	const hasNativeShare = canNativeShare();

	$effect(() => {
		if (open && dialog) dialog.showModal();
		else if (!open && dialog) dialog.close();
	});

	async function handleShare() {
		const text = cart.formatText();
		const result = await shareText({
			title: "Мой подбор — ЭлектроЦентр",
			text,
		});
		if (result === "shared" || result === "copied") {
			shareState = result;
			haptics.success();
			setTimeout(() => shareState = "", 2000);
		} else if (result === "error") {
			haptics.error();
		}
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={onclose}>
	<div class="modal-box w-full max-w-lg h-full max-h-full sm:max-h-[90vh] sm:rounded-2xl"
		style="padding-top: calc(1.5rem + env(safe-area-inset-top, 0px))">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-bold">Список для менеджера</h2>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={onclose}>
				<X size={20} />
			</button>
		</div>

		{#if cart.count === 0}
			<p class="text-center text-base-content/50 py-12">Список пуст</p>
		{:else}
			<div class="space-y-3 mb-6">
				{#each cart.items as item (item.id)}
					<div class="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
						<div class="flex-1 min-w-0">
							<p class="article-code text-lg font-bold truncate">{item.article}</p>
							<p class="text-sm text-base-content/70 leading-tight">{item.name}</p>
						</div>
						<div class="flex items-center gap-1 shrink-0">
							<button class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]"
								onclick={() => { haptics.tap(); cart.updateQty(item.id, item.qty - 1); }}>
								<Minus size={20} />
							</button>
							<span class="w-10 text-center text-lg font-bold">{item.qty}</span>
							<button class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]"
								onclick={() => { haptics.tap(); cart.updateQty(item.id, item.qty + 1); }}>
								<Plus size={20} />
							</button>
							<button class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px] text-error"
								onclick={() => { haptics.tap(); cart.remove(item.id); }}>
								<Trash2 size={20} />
							</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Итого -->
			{@const total = cart.items.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0)}
			{#if total > 0}
				<div class="flex items-center justify-between p-3 bg-base-200 rounded-lg mb-1">
					<span class="text-base-content/70">Примерная сумма:</span>
					<span class="text-xl font-bold">~{total.toLocaleString("ru-RU")} ₽</span>
				</div>
				<p class="text-xs text-base-content/50 text-center mb-3">Цены розничные. Ваша скидка — у менеджера</p>
			{/if}

			<div class="flex flex-col gap-2">
				<!-- Главная: нативное системное «Поделиться» — клиент выбирает куда (WhatsApp/AirDrop/почта/заметки) -->
				<button class="btn btn-primary w-full gap-2 min-h-[48px]"
					onclick={handleShare}>
					{#if shareState === "shared"}
						<Check size={18} /> Отправлено
					{:else if shareState === "copied"}
						<Check size={18} /> Скопировано в буфер
					{:else}
						<Share2 size={18} /> {hasNativeShare ? "Поделиться" : "Скопировать список"}
					{/if}
				</button>

				<button class="btn btn-ghost min-h-[44px]"
					onclick={() => { haptics.tap(); cart.clear(); }}>
					Очистить список
				</button>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
