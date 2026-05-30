<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import NavBar from '$lib/components/NavBar.svelte';
	import { connectEntitySSE, disconnectEntitySSE } from '$lib/services/entitySseService';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		connectEntitySSE();
		return disconnectEntitySSE;
	});
</script>

<div class="flex h-screen flex-col overflow-hidden">
	<NavBar authenticated={$page.data.authenticated} />
	<div class="flex-1 overflow-y-auto">
		{@render children()}
	</div>
</div>
