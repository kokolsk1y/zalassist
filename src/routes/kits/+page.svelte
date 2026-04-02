<script>
	import { base } from "$app/paths";
	import { Package } from "lucide-svelte";
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center px-4">
	<div class="text-primary mb-6">
		<Package size={48} />
	</div>
	<h1 class="text-2xl font-bold text-base-content mb-4">Готовые комплекты</h1>
	<p class="text-base-content/60 mb-8 text-center">Этот раздел появится в следующем обновлении</p>
	<a href="{base}/" class="btn btn-primary">На главную</a>
</div>
