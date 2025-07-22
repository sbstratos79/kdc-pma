<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import { architectData, projectData } from '$lib/stores.js';

	let { children, data } = $props();

	// Initialize stores with server data
	onMount(() => {
		if (data.architectData?.length > 0) {
			architectData.set(data.architectData);
		}
		if (data.projectData?.length > 0) {
			projectData.set(data.projectData);
		}
	});

	// Also update stores if data changes (for reactive updates)
	$effect(() => {
		if (data.architectData?.length > 0) {
			architectData.set(data.architectData);
		}
		if (data.projectData?.length > 0) {
			projectData.set(data.projectData);
		}
	});
</script>

<NavBar />
{@render children()}
