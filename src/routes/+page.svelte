<script>
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import ArchitectProjectTaskGrid from '$lib/components/ArchitectProjectTaskGrid.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import PendingTasksCarousel from '$lib/components/PendingTasksCarousel.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('tts-enabled');
			if (saved !== null) {
				const enabled = saved === 'true';
				// Import and use the service
				import('$lib/services/ttsNotificationService').then(({ ttsNotificationService }) => {
					ttsNotificationService.setEnabled(enabled);
				});
			}
		}
	});
</script>

<div class="px-3 md:px-10">
	<div class="flex w-full flex-col items-center justify-center overflow-hidden">
		<div class="w-full">
			<PendingTasksCarousel />
		</div>

		<div
			class="align-center flex min-w-full grow flex-col items-center justify-between gap-4 md:flex-row md:items-start"
		>
			<!-- Architects Accordion: add overflow-hidden + rounded + border-0 so inner gradients don't show seams -->
			<Accordion class="w-full overflow-hidden rounded-xl border-0 md:w-1/2">
				<AccordionItem
					open
					classes={{
						active: 'max-w-full p-2 bg-gradient-to-b from-slate-100 to-amber-200',
						inactive: 'max-w-full rounded-xl p-2 bg-gradient-to-b from-amber-50 to-orange-100',
						content: 'p-2'
					}}
				>
					{#snippet arrowup()}
						<div></div>
					{/snippet}
					{#snippet arrowdown()}
						<div></div>
					{/snippet}
					{#snippet header()}
						<div class="text-2xl font-bold text-amber-700">Architects</div>
					{/snippet}
					<ArchitectProjectTaskGrid />
				</AccordionItem>
			</Accordion>

			<!-- Projects Accordion -->
			<Accordion class="w-full overflow-hidden rounded-xl border-0 md:w-1/2">
				<AccordionItem
					open
					classes={{
						active: 'max-w-full p-2 bg-gradient-to-b from-slate-100 to-blue-200',
						inactive: 'max-w-full rounded-xl p-2 bg-gradient-to-b from-emerald-50 to-blue-100',
						content: 'p-2'
					}}
				>
					{#snippet arrowup()}
						<div></div>
					{/snippet}
					{#snippet arrowdown()}
						<div></div>
					{/snippet}
					{#snippet header()}
						<div class="text-2xl font-bold text-cyan-900">Projects</div>
					{/snippet}
					<ProjectGrid />
				</AccordionItem>
			</Accordion>
		</div>
	</div>
</div>
