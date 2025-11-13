<script>
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import ArchitectProjectTaskGrid from '$lib/components/ArchitectProjectTaskGrid.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import PendingTasksCarousel from '$lib/components/PendingTasksCarousel.svelte';
</script>

<div class="flex w-[100%] flex-col items-center justify-center">
	<div class="mx-5 w-full">
		<PendingTasksCarousel />
	</div>
	<div
		class="align-center flex min-w-[100%] grow flex-col items-center justify-between gap-4 xl:flex-row xl:items-start xl:justify-center"
	>
		<Accordion class="w-full xl:w-[49%]">
			<AccordionItem
				open
				classes={{
					active: 'max-w-full p-2 bg-gradient-to-b from-slate-100 to-amber-200',
					inactive: 'max-w-full rounded-xl p-2 bg-gradient-to-b from-amber-50 to-orange-100'
				}}
			>
				{#snippet header()}<div class="text-2xl font-bold">Architects</div>{/snippet}
				<ArchitectProjectTaskGrid />
			</AccordionItem></Accordion
		>
		<Accordion class="w-full xl:w-[45%]">
			<AccordionItem
				open
				classes={{
					active: 'max-w-full p-2 bg-gradient-to-b from-slate-100 to-blue-200',
					inactive: 'max-w-full rounded-xl p-2 bg-gradient-to-b from-emerald-50 to-blue-100'
				}}
			>
				{#snippet header()}<div class="text-2xl font-bold">Projects</div>{/snippet}
				<ProjectGrid />
			</AccordionItem></Accordion
		>
	</div>
</div>
