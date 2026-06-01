<script lang="ts">
	import { onMount } from 'svelte';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { getPriorityGradient, getStatusColor, getStatusBarColor } from '$lib/utils/colorUtils';

	// same stores and pattern used in other components
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { SvelteDate } from 'svelte/reactivity';
	import type { Architect, Project, Task } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CarouselArrowIcon from '$lib/components/CarouselArrowIcon.svelte';

	let loading = $state(true);
	let error: string | null = $state(null);

	// Local copies of store state - added byId for enrichment
	let architectsState = $state({
		list: [] as Architect[],
		loading: true,
		error: null as string | null,
		byId: {} as Record<string, Architect>
	});
	let projectsState = $state({
		list: [] as Project[],
		loading: true,
		error: null as string | null,
		byId: {} as Record<string, Project>
	});
	let tasksState = $state({
		list: [] as Task[],
		loading: true,
		error: null as string | null,
		byId: {} as Record<string, Task>
	});

	$effect(() => {
		const unsub = architectsStore.subscribe((s) => {
			architectsState = s;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = projectsStore.subscribe((s) => {
			projectsState = s;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = tasksStore.subscribe((s) => {
			tasksState = s;
		});
		return unsub;
	});

	// Derived: today's pending tasks (due today and not Completed/Cancelled)
	let todaysPendingTasks = $derived.by(() => {
		const tasks = tasksState.list || [];
		const today = new SvelteDate();
		today.setHours(0, 0, 0, 0);

		return tasks.filter((task) => {
			if (!task?.taskDueDate) return false;
			const due = new SvelteDate(task.taskDueDate);
			if (Number.isNaN(due.getTime())) return false;
			due.setHours(0, 0, 0, 0);

			const notFinished =
				(task.taskStatus ?? '').toLowerCase() !== 'completed' &&
				(task.taskStatus ?? '').toLowerCase() !== 'cancelled';

			return due.getTime() === today.getTime() && notFinished;
		});
	});

	// Slide width scaled up by ~50% from previous defaults.
	// Responsive: smaller on mobile, larger on desktop
	// Mobile: 280px, Tablet: 380px, Desktop: 480px

	// Reactive state for slides per page based on screen size
	let slidesPerPage = $state(1);

	onMount(() => {
		loading = true;

		const updateSlidesPerPage = () => {
			const width = window.innerWidth;
			slidesPerPage = width / 360;
		};

		// Set initial value
		updateSlidesPerPage();

		// Update on resize
		window.addEventListener('resize', updateSlidesPerPage);

		// Refresh data when window regains focus
		const handleFocus = async () => {
			await Promise.all([architectsStore.refresh(), projectsStore.refresh(), tasksStore.refresh()]);
			// CRITICAL: Re-enrich tasks after refresh
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
		};
		window.addEventListener('focus', handleFocus);

		// async load
		(async () => {
			try {
				await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);
				// CRITICAL: enrich tasks with names
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			} catch (err) {
				console.error('Error loading pending tasks:', err);
				if (err instanceof Error) error = err.message;
				else error = 'Unknown error';
			} finally {
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('resize', updateSlidesPerPage);
		};
	});
</script>

{#if loading}
	<LoadingSpinner size="lg" />
{:else if error}
	<ErrorState message={error} />
{:else if todaysPendingTasks.length === 0}
	<EmptyState message="No pending tasks for today." />
{:else}
	<Carousel.Root
		defaultPage={0}
		slideCount={todaysPendingTasks.length}
		autoplay={{ delay: 5000 }}
		loop
		allowMouseDrag
		spacing="4px"
		class="carousel-root group/card"
		padding="40px"
		{slidesPerPage}
	>
		<Carousel.Context>
			{#snippet render(api)}
				<Carousel.ItemGroup onpointerover={() => api().pause()} onpointerleave={() => api().play()}>
					{#each todaysPendingTasks as task, index (task.taskId)}
						<!-- slide: responsive fixed width -->
						<Carousel.Item {index} class="max-h-50 max-w-90 py-2">
							<div
								class="flex h-full overflow-hidden rounded-lg border border-neutral-600/20 bg-linear-to-br {getPriorityGradient(
									task.taskPriority
								)} duration-200"
							>
								{#if task.taskStatus}
									<div class="w-[10px] shrink-0 {getStatusBarColor(task.taskStatus)}"></div>
									<div class="w-2.5 shrink-0"></div>
								{/if}
								<div class="flex min-w-0 flex-col px-2 py-1 md:px-3 md:py-2">
									<!-- Header with priority dot and title -->
									<div class="flex items-center gap-2 md:gap-3">
										<h3 class="truncate text-base font-bold text-gray-900 sm:text-lg md:text-xl">
											{task.taskName}
										</h3>
									</div>

									<!-- Status and Project badges -->
									<div class="flex flex-wrap items-center gap-2">
										{#if task.taskStatus}
											<span
												class="rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap md:px-3 md:py-1 md:text-sm {getStatusColor(
													task.taskStatus
												)}"
											>
												{task.taskStatus}
											</span>
										{/if}
										{#if task.projectName}
											<span
												class="truncate rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 md:px-3 md:py-1 md:text-sm"
											>
												{task.projectName}
											</span>
										{/if}
									</div>

									<!-- Description - flexible space -->
									<div class="my-2 flex-1">
										{#if task.taskDescription}
											<p class="line-clamp-3 text-xs text-gray-600 sm:text-sm md:text-base">
												{task.taskDescription}
											</p>
										{/if}
									</div>

									<!-- Assigned to text - pinned to bottom -->
									<div class="border-t border-gray-200 pt-2">
										{#if task.architectName}
											<p class="text-xl text-gray-700">
												Assigned to: <span class="font-bold text-gray-900"
													>{task.architectName}</span
												>
											</p>
										{:else}
											<p class="text-xs text-gray-500 italic sm:text-sm">Unassigned</p>
										{/if}
									</div>
								</div>
							</div>
						</Carousel.Item>
					{/each}
				</Carousel.ItemGroup>
			{/snippet}
		</Carousel.Context>
		{#if todaysPendingTasks.length > 1}
			<!-- Navigation Controls - Show on Hover -->
			<Carousel.Control class="carousel-control">
				<Carousel.PrevTrigger class="carousel-trigger left-2">
					<CarouselArrowIcon direction="left" />
				</Carousel.PrevTrigger>

				<Carousel.NextTrigger class="carousel-trigger right-2">
					<CarouselArrowIcon direction="right" />
				</Carousel.NextTrigger>
			</Carousel.Control>
		{/if}
	</Carousel.Root>
{/if}

<style>
	/* keep embla container vertically centered */
	.embla__container {
		align-items: stretch;
	}
</style>
