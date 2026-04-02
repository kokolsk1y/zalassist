<script>
	import { toast } from "$lib/stores/toast.svelte.js";
</script>

{#if toast.visible}
	<div class="toast toast-top toast-center z-[100]">
		<div class="alert alert-success shadow-lg">
			<span>{toast.message}</span>
		</div>
	</div>
{/if}
