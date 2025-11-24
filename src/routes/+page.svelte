<script>
	import ArchitectProjectTaskGrid from '$lib/components/ArchitectProjectTaskGrid.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import PendingTasksVerticalCarousel from '$lib/components/PendingTasksVerticalCarousel.svelte';
	import PendingTasksCarousel from '$lib/components/PendingTasksCarousel.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { ttsNotificationService } from '$lib/services/ttsNotificationService';

	onMount(() => {
		// Import and initialize the service

		ttsNotificationService.init();

		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('tts-enabled');
			if (saved !== null) {
				const enabled = saved === 'true';
				ttsNotificationService.setEnabled(enabled);
			}
		}
	});

	onDestroy(() => {
		ttsNotificationService.disconnect();
	});
</script>

<div class="px-2 pt-2 md:px-6 lg:pt-6">
	<div class="flex flex-col items-start gap-2 lg:h-full lg:flex-row lg:gap-6">
		<div class="hidden h-full lg:block lg:w-1/7">
			<PendingTasksVerticalCarousel />
		</div>

		<div class="block w-full lg:hidden">
			<PendingTasksCarousel />
		</div>

		<div
			class="flex h-full w-full grow flex-col items-start justify-start gap-2 overflow-hidden md:w-6/7 lg:gap-6"
		>
			<ArchitectProjectTaskGrid />
			<ProjectGrid />
		</div>
	</div>
</div>

<style>
	div:empty {
		display: none;
	}
</style>
