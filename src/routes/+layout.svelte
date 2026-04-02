<script>
	import "../app.css";
	let { children } = $props();
</script>

<svelte:head>
	<meta name="theme-color" content="#2b7de0" />
</svelte:head>

{@render children()}
