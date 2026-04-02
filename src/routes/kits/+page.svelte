<script>
	import { base } from "$app/paths";
	import { ArrowLeft, Package } from "lucide-svelte";
</script>

<div class="min-h-screen bg-base-200 flex flex-col">
	<div class="sticky top-0 bg-base-100 shadow-sm z-40 px-4 py-3">
		<div class="flex items-center gap-3 max-w-md mx-auto">
			<a href="{base}/" class="btn btn-ghost btn-sm btn-circle" aria-label="Назад" data-sveltekit-reload>
				<ArrowLeft size={20} />
			</a>
			<h1 class="text-lg font-bold">Готовые комплекты</h1>
		</div>
	</div>
	<div class="flex-1 flex flex-col items-center justify-center px-4">
		<div class="text-primary mb-6">
			<Package size={48} />
		</div>
		<p class="text-base-content/60 mb-8 text-center">Этот раздел появится в следующем обновлении</p>
		<a href="{base}/" class="btn btn-primary">На главную</a>
	</div>
</div>
