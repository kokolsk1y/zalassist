<script>
	import { getCartItems, getCartCount, updateCartQty, removeFromCart, clearCart, formatCartText } from "$lib/stores/cart.svelte.js";
	import { copyToClipboard } from "$lib/utils/clipboard.js";
	import { X, Minus, Plus, Trash2, Copy, Check, Mail, Send } from "lucide-svelte";

	let { open, onclose } = $props();
	let copied = $state(false);
	let dialog;

	$effect(() => {
		if (open && dialog) dialog.showModal();
		else if (!open && dialog) dialog.close();
	});
</script>

<dialog bind:this={dialog} class="modal" onclose={onclose}>
	<div class="modal-box w-full max-w-lg h-full max-h-full sm:max-h-[90vh] sm:rounded-2xl">
		<!-- Header -->
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-bold">Список для менеджера</h2>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={onclose}>
				<X size={20} />
			</button>
		</div>

		{#if getCartCount() === 0}
			<p class="text-center text-base-content/50 py-12">Список пуст</p>
		{:else}
			<!-- Товары -->
			<div class="space-y-3 mb-6">
				{#each getCartItems() as item (item.id)}
					<div class="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
						<div class="flex-1 min-w-0">
							<p class="font-mono text-lg font-bold truncate">{item.article}</p>
							<p class="text-sm text-base-content/70 leading-tight">{item.name}</p>
						</div>
						<div class="flex items-center gap-1 shrink-0">
							<button class="btn btn-ghost btn-xs btn-circle"
								onclick={() => updateCartQty(item.id, item.qty - 1)}>
								<Minus size={14} />
							</button>
							<span class="w-8 text-center font-bold">{item.qty}</span>
							<button class="btn btn-ghost btn-xs btn-circle"
								onclick={() => updateCartQty(item.id, item.qty + 1)}>
								<Plus size={14} />
							</button>
							<button class="btn btn-ghost btn-xs btn-circle text-error"
								onclick={() => removeFromCart(item.id)}>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Actions -->
			<div class="flex flex-col gap-2">
				<button class="btn btn-primary w-full gap-2"
					onclick={() => {
						copyToClipboard(formatCartText());
						copied = true;
						setTimeout(() => copied = false, 2000);
					}}>
					{#if copied}
						<Check size={18} /> Скопировано!
					{:else}
						<Copy size={18} /> Скопировать список
					{/if}
				</button>

				<!-- Поделиться -->
				<div class="flex gap-2">
					<a
						href="mailto:?subject=Список товаров ЭлектроЦентр&body={encodeURIComponent(formatCartText())}"
						class="btn btn-outline btn-sm flex-1 gap-1"
					>
						<Mail size={16} /> Почта
					</a>
					<a
						href="https://wa.me/?text={encodeURIComponent(formatCartText())}"
						target="_blank"
						rel="noopener"
						class="btn btn-outline btn-sm flex-1 gap-1"
					>
						<Send size={16} /> WhatsApp
					</a>
					<a
						href="https://t.me/share/url?text={encodeURIComponent(formatCartText())}"
						target="_blank"
						rel="noopener"
						class="btn btn-outline btn-sm flex-1 gap-1"
					>
						<Send size={16} /> Telegram
					</a>
				</div>

				<button class="btn btn-ghost btn-sm" onclick={() => clearCart()}>
					Очистить список
				</button>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
