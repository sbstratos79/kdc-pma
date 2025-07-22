<script>
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import ArchitectGrid from '$lib/components/ArchitectGrid.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';

	let { data } = $props();
	let { architectDataValues, projectDataValues } = data;
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
				<ArchitectGrid {architectDataValues} />
			</AccordionItem></Accordion
		>
		<Accordion class="w-full xl:w-[45%]">
			<AccordionItem
				open
				inactiveClass="max-w-full rounded-xl p-2 bg-gradient-to-b from-emerald-50 to-blue-100"
				activeClass="max-w-full p-2 bg-gradient-to-b from-slate-100 to-blue-200"
			>
				{#snippet header()}<h1 class="text-2xl font-bold">Projects</h1>{/snippet}
				<ProjectGrid {projectDataValues} />
			</AccordionItem></Accordion
		>
	</div>
</div>
