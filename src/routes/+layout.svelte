<script lang="ts">
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';
	// import { ptsDataStore } from '$lib/stores/ptsDataStore';

	let { children } = $props();
</script>

<NavBar />
{@render children()}
