<script lang="ts">
	// (All imports, stores, derived state, onMount logic, etc.)
	// --------------------------------------------------------
	import { onMount } from 'svelte';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { getPriorityGradient, getStatusBarColor } from '$lib/utils/colorUtils';

	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { SvelteDate } from 'svelte/reactivity';
	import type { Architect, Project, Task } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import CarouselArrowIcon from '$lib/components/CarouselArrowIcon.svelte';

	let loading = $state(true);
	let error: string | null = $state(null);

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

	$effect(() => architectsStore.subscribe((s) => (architectsState = s)));
	$effect(() => projectsStore.subscribe((s) => (projectsState = s)));
	$effect(() => tasksStore.subscribe((s) => (tasksState = s)));

	let todaysPendingTasks: Task[] = $derived.by(() => {
		const tasks: Task[] = tasksState.list || [];
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

	const SLIDE_HEIGHT_PX = 150;
	const SLIDE_MAX_HEIGHT_PX = 220;
	const CAROUSEL_SPACING_PX = 8;

	const getSlideHeight = () => {
		if (typeof window === 'undefined') return SLIDE_HEIGHT_PX;
		if (window.innerHeight < 640) return 130;
		if (window.innerHeight < 1024) return 150;
		if (window.innerHeight < 1440) return 170;
		return 200;
	};

	let slideHeight = $state(getSlideHeight());
	let baseSlidesPerPage = $state(1);
	let slidesPerPage = $derived(Math.min(baseSlidesPerPage, todaysPendingTasks.length || 1));

	onMount(() => {
		loading = true;

		const updateSlidesPerPage = () => {
			if (typeof window === 'undefined') return;
			const height = window.innerHeight;
			slideHeight = Math.min(getSlideHeight(), SLIDE_MAX_HEIGHT_PX);

			const availableHeight = height - height * 0.3;
			const maxSlides = Math.floor(
				(availableHeight + CAROUSEL_SPACING_PX) / (slideHeight + CAROUSEL_SPACING_PX)
			);

			baseSlidesPerPage = Math.max(1, maxSlides);
		};

		updateSlidesPerPage();
		window.addEventListener('resize', updateSlidesPerPage);

		const handleFocus = async () => {
			await Promise.all([architectsStore.refresh(), projectsStore.refresh(), tasksStore.refresh()]);
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
		};
		window.addEventListener('focus', handleFocus);

		const refreshInterval = window.setInterval(async () => {
			await Promise.all([architectsStore.refresh(), projectsStore.refresh(), tasksStore.refresh()]);
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
		}, 30000);

		(async () => {
			try {
				await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			} catch (err) {
				console.error(err);
				error = err instanceof Error ? err.message : 'Unknown error occurred';
			} finally {
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('resize', updateSlidesPerPage);
			window.removeEventListener('focus', handleFocus);
			if (refreshInterval) window.clearInterval(refreshInterval);
		};
	});
</script>

{#if loading}
	<LoadingSpinner size="lg" />
{:else if error}
	<ErrorState message={error} />
{:else if todaysPendingTasks.length === 0}
	<!-- nothing to show -->
{:else}
	<div
		class="carousel-container w-full"
		style="height: {slideHeight * slidesPerPage +
			CAROUSEL_SPACING_PX * (slidesPerPage - 1)}px; max-height: calc(100vh - 200px);"
	>
		<Carousel.Root
			orientation="vertical"
			defaultPage={0}
			slideCount={todaysPendingTasks.length}
			autoplay={{ delay: 5000 }}
			loop
			allowMouseDrag
			spacing="{CAROUSEL_SPACING_PX}px"
			{slidesPerPage}
			class="h-full w-full"
		>
			<Carousel.Context>
				{#snippet render(api)}
					<div class="group/carousel relative h-full w-full overflow-hidden">
						<Carousel.ItemGroup
							onpointerover={() => api().pause()}
							onpointerleave={() => api().play()}
							class="flex h-full w-full flex-col"
						>
							{#each todaysPendingTasks as task, index (task.taskId)}
								<Carousel.Item
									{index}
									class="carousel-item w-full flex-shrink-0"
									style="height: {slideHeight}px; min-height: {slideHeight}px; max-height: {slideHeight}px;"
								>
									<div
										class="task-card mx-auto flex h-full w-full overflow-hidden rounded-lg border border-neutral-600/20 bg-gradient-to-br shadow-sm transition-shadow duration-200 hover:shadow-md {getPriorityGradient(
											task.taskPriority
										)}"
									>
										{#if task.taskStatus}
											<div class="w-[10px] shrink-0 {getStatusBarColor(task.taskStatus)}"></div>
											<div class="w-2.5 shrink-0"></div>
										{/if}
										<div class="flex h-full min-w-0 flex-col overflow-hidden p-2">
											<!-- Task Title -->
											<h3
												class="mb-2 line-clamp-2 text-lg leading-tight font-bold text-gray-900 lg:text-2xl xl:text-3xl"
											>
												{task.taskName}
											</h3>

											<!-- Project Badge (status indicated by colored left bar) -->
											{#if task.projectName}
												<div class="mb-auto flex flex-wrap gap-2 overflow-hidden">
													<span
														class="inline-flex max-w-full min-w-0 items-center rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800 lg:text-sm xl:text-base"
														title={task.projectName}
													>
														<span class="truncate">{task.projectName}</span>
													</span>
												</div>
											{/if}

											<!-- Assignment Info -->
											<div class="mt-3 flex-shrink-0 border-t border-gray-200 pt-3">
												{#if task.architectName}
													<div class="flex min-w-0 items-center gap-2">
														<span
															class="flex-shrink-0 text-sm text-gray-600 lg:text-base xl:text-lg"
															>Assigned to:</span
														>
														<span
															class="min-w-0 truncate font-semibold text-gray-900 lg:text-base xl:text-lg"
															title={task.architectName}
														>
															{task.architectName}
														</span>
													</div>
												{:else}
													<p class="text-sm text-gray-500 italic lg:text-base">Unassigned</p>
												{/if}
											</div>
										</div>
									</div>
								</Carousel.Item>
							{/each}
						</Carousel.ItemGroup>

						<!-- Navigation Controls -->
						<Carousel.Control
							class="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-2"
						>
							<Carousel.PrevTrigger
								class="pointer-events-auto rounded-full bg-white p-2 opacity-0 shadow-lg transition-all duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
								aria-label="Previous task"
							>
								<CarouselArrowIcon direction="up" />
							</Carousel.PrevTrigger>

							<Carousel.NextTrigger
								class="pointer-events-auto rounded-full bg-white p-2 opacity-0 shadow-lg transition-all duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
								aria-label="Next task"
							>
								<CarouselArrowIcon direction="down" />
							</Carousel.NextTrigger>
						</Carousel.Control>
					</div>
				{/snippet}
			</Carousel.Context>
		</Carousel.Root>
	</div>
{/if}

<style>
	.carousel-container {
		max-width: 100%;
		overflow: hidden;
		box-sizing: border-box;
	}

	.carousel-item {
		box-sizing: border-box;
		padding: 0;
	}

	.task-card {
		box-sizing: border-box;
		max-width: 100%;
		overflow: hidden;
	}
</style>
