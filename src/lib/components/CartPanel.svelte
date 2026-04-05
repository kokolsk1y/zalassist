<script>
	import { useCart } from "$lib/stores/cart.svelte.js";
	import { copyToClipboard } from "$lib/utils/clipboard.js";
	import { X, Minus, Plus, Trash2, Copy, Check, Mail, Send } from "lucide-svelte";

	let { open, onclose } = $props();
	let copied = $state(false);
	let dialog;
	const cart = useCart();

	$effect(() => {
		if (open && dialog) dialog.showModal();
		else if (!open && dialog) dialog.close();
	});
</script>

<dialog bind:this={dialog} class="modal" onclose={onclose}>
	<div class="modal-box w-full max-w-lg h-full max-h-full sm:max-h-[90vh] sm:rounded-2xl">
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
							<p class="font-mono text-lg font-bold truncate">{item.article}</p>
							<p class="text-sm text-base-content/70 leading-tight">{item.name}</p>
						</div>
						<div class="flex items-center gap-1 shrink-0">
							<button class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]"
								onclick={() => cart.updateQty(item.id, item.qty - 1)}>
								<Minus size={20} />
							</button>
							<span class="w-10 text-center text-lg font-bold">{item.qty}</span>
							<button class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]"
								onclick={() => cart.updateQty(item.id, item.qty + 1)}>
								<Plus size={20} />
							</button>
							<button class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px] text-error"
								onclick={() => cart.remove(item.id)}>
								<Trash2 size={20} />
							</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Итого -->
			{@const total = cart.items.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0)}
			{#if total > 0}
				<div class="flex items-center justify-between p-3 bg-base-200 rounded-lg mb-2">
					<span class="text-base-content/70">Примерная сумма:</span>
					<span class="text-xl font-bold">~{total.toLocaleString("ru-RU")} ₽</span>
				</div>
			{/if}

			<div class="flex flex-col gap-2">
				<button class="btn btn-primary w-full gap-2"
					onclick={() => {
						copyToClipboard(cart.formatText());
						copied = true;
						setTimeout(() => copied = false, 2000);
					}}>
					{#if copied}
						<Check size={18} /> Скопировано!
					{:else}
						<Copy size={18} /> Скопировать список
					{/if}
				</button>

				<div class="flex gap-2">
					<a href="mailto:?subject=Список товаров ЭлектроЦентр&body={encodeURIComponent(cart.formatText())}"
						class="btn btn-outline flex-1 gap-1 min-h-[44px]">
						<Mail size={20} /> Почта
					</a>
					<a href="https://wa.me/?text={encodeURIComponent(cart.formatText())}"
						target="_blank" rel="noopener" class="btn btn-outline flex-1 gap-1 min-h-[44px]">
						<Send size={20} /> WhatsApp
					</a>
					<a href="https://t.me/share/url?text={encodeURIComponent(cart.formatText())}"
						target="_blank" rel="noopener" class="btn btn-outline flex-1 gap-1 min-h-[44px]">
						<Send size={20} /> Telegram
					</a>
				</div>

				<button class="btn btn-ghost min-h-[44px]" onclick={() => cart.clear()}>
					Очистить список
				</button>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
