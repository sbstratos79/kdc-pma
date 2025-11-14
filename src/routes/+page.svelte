<script>
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { Collapsible } from '@ark-ui/svelte/collapsible';
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
			<Collapsible.Root
				defaultOpen
				class="group h-auto w-full shrink grow rounded-xl border border-gray-200"
			>
				<Collapsible.Trigger
					class="flex h-12 w-full min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-t-lg bg-linear-to-b from-slate-100 to-amber-200 p-2 text-center text-2xl font-bold text-amber-700"
				>
					Architects
				</Collapsible.Trigger>
				<Collapsible.Content class="m-2">
					<ArchitectProjectTaskGrid />
				</Collapsible.Content>
			</Collapsible.Root>

			<!-- Projects Accordion -->

			<Collapsible.Root
				defaultOpen
				class="group h-auto w-full shrink grow rounded-xl border border-gray-200"
			>
				<Collapsible.Trigger
					class="flex h-12 w-full min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-t-lg bg-linear-to-b from-slate-100 to-blue-200 p-2 text-2xl font-bold text-cyan-900"
				>
					Projects
				</Collapsible.Trigger>
				<Collapsible.Content class="m-2">
					<ProjectGrid />
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	</div>
</div>
