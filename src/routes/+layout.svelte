<script lang="ts">
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';
	// import { ptsDataStore } from '$lib/stores/ptsDataStore';

	let { children } = $props();
</script>

<div class="h-screen flex flex-col overflow-hidden">
	<NavBar />
	<div class="flex-1 overflow-y-auto">
		{@render children()}
	</div>
</div>
