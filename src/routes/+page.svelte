<script>
	import { onMount, onDestroy } from 'svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import ArchitectGrid from '$lib/components/ArchitectGrid.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import { ptsDataStore, architectData, projectData } from '$lib/stores/ptsDataStore';

	onMount(async () => {
		try {
			const response = await fetch('/api/pts');
			const initialData = await response.json();
			ptsDataStore.init(initialData);

			// Start polling after initial load
			ptsDataStore.startPolling(30000);
		} catch (error) {
			console.error('Failed to load initial data:', error);
		}
	});

	onDestroy(() => {
		ptsDataStore.stopPolling();
	});
</script>

<div class="flex h-screen w-screen items-start justify-center">
	<div
		class="align-center mx-2 flex w-[98%] grow flex-col items-center justify-between gap-4 xl:flex-row xl:items-start xl:justify-center"
	>
		<Accordion class="w-full xl:w-[47%]">
			<AccordionItem
				open
				inactiveClass="max-w-full rounded-xl p-2 bg-gradient-to-b from-amber-50 to-orange-100"
				activeClass="max-w-full p-2 bg-gradient-to-b from-slate-100 to-amber-200"
			>
				{#snippet header()}<h1 class="text-2xl font-bold">Architects</h1>{/snippet}
				<ArchitectGrid architectDataValues={$architectData} />
			</AccordionItem></Accordion
		>
		<Accordion class="w-full xl:w-[45%]">
			<AccordionItem
				open
				inactiveClass="max-w-full rounded-xl p-2 bg-gradient-to-b from-emerald-50 to-blue-100"
				activeClass="max-w-full p-2 bg-gradient-to-b from-slate-100 to-blue-200"
			>
				{#snippet header()}<h1 class="text-2xl font-bold">Projects</h1>{/snippet}
				<ProjectGrid projectDataValues={$projectData} />
			</AccordionItem></Accordion
		>
	</div>
</div>
