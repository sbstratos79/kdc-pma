<script>
	import ArchitectProjectTaskGrid from '$lib/components/ArchitectProjectTaskGrid.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import PendingTasksVerticalCarousel from '$lib/components/PendingTasksVerticalCarousel.svelte';
	import PendingTasksCarousel from '$lib/components/PendingTasksCarousel.svelte';
	import FooterLegend from '$lib/components/FooterLegend.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { ttsNotificationService } from '$lib/services/ttsNotificationService';
	import { viewportStore } from '$lib/stores';

	let vp = $state({ width: 1920, height: 1080, scale: 1, layoutWidth: 1920, layoutHeight: 1080 });

	$effect(() => viewportStore.subscribe((s) => (vp = s)));

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

<div class="h-full w-full overflow-hidden">
	<div
		class="flex h-full flex-col overflow-y-auto px-2 pt-2 md:px-6 lg:flex-row lg:gap-6 lg:overflow-hidden lg:pt-6"
		style="width: calc(100% / {vp.scale}); height: calc(100% / {vp.scale}); transform: scale({vp.scale}); transform-origin: top left;"
	>
		<div class="hidden overflow-y-auto lg:block lg:w-[20%]">
			<PendingTasksVerticalCarousel />
		</div>
		<div class="block w-full flex-shrink-0 lg:hidden">
			<PendingTasksCarousel />
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-2 lg:h-full lg:gap-6 lg:overflow-y-auto">
			<ProjectGrid />
			<ArchitectProjectTaskGrid />
			<FooterLegend />
		</div>
	</div>
</div>

<style>
	div:empty {
		display: none;
	}
</style>
