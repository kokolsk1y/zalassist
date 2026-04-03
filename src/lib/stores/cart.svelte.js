import { cartStore, cartAdd, cartRemove, cartUpdateQty, cartClear, formatCartText } from "./cart.js";

/**
 * Реактивный хук для корзины. Вызывать в <script> компонента.
 * Возвращает объект с reactive items/count и методами.
 */
export function useCart() {
	let items = $state([]);

	$effect(() => {
		const unsub = cartStore.subscribe(v => { items = v; });
		return unsub;
	});

	return {
		get items() { return items; },
		get count() { return items.length; },
		add: cartAdd,
		remove: cartRemove,
		updateQty: cartUpdateQty,
		clear: cartClear,
		formatText() { return formatCartText(items); }
	};
}
