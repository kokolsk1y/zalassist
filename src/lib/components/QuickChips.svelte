<script>
	let { chips = [], onselect, disabled = false } = $props();
</script>

<div class="flex flex-wrap gap-2 px-4 py-2">
	{#each chips as chip}
		<button
			class="btn btn-sm btn-outline btn-primary"
			{disabled}
			onclick={() => onselect?.(chip)}
		>
			{chip}
		</button>
	{/each}
</div>

<script context="module">
	export const INITIAL_CHIPS = [
		"Нужна помощь с электрикой",
		"Собираю щиток",
		"Что выбрать для розеток?"
	];

	export const FOLLOWUP_CHIPS = [
		"Что ещё понадобится?",
		"Покажи аналоги",
		"Спасибо, этого достаточно"
	];
</script>
