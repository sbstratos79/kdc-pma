<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import { ptsDataStore } from '$lib/stores/ptsDataStore';

	onMount(async () => {
		ptsDataStore.ensureInitialized();
	});

	onDestroy(() => {
		ptsDataStore.stopPolling();
	});

	let { children } = $props();
</script>

<NavBar />
{@render children()}
