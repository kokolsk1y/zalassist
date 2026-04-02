<script>
	import "../app.css";
	import Toast from "$lib/components/Toast.svelte";
	let { children } = $props();
</script>

<svelte:head>
	<meta name="theme-color" content="#2b7de0" />
</svelte:head>

{@render children()}
<Toast />
