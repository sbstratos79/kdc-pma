<script lang="ts">
	// --- Your existing script EXACTLY as-is ---
	// (All imports, stores, derived state, onMount logic, etc.)
	// --------------------------------------------------------
	import { onMount } from 'svelte';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { getPriorityGradient, getStatusColor } from '$lib/utils/colorUtils';

	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { SvelteDate } from 'svelte/reactivity';
	import type { Task } from '$lib/types';

	let loading = $state(true);
	let error: string | null = $state(null);

	let architectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let projectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let tasksState = $state({ list: [], loading: true, error: null, byId: {} });

	$effect(() => architectsStore.subscribe(s => (architectsState = s)));
	$effect(() => projectsStore.subscribe(s => (projectsState = s)));
	$effect(() => tasksStore.subscribe(s => (tasksState = s)));

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

	const SLIDE_HEIGHT_PX = 140;
	const SLIDE_MAX_HEIGHT_PX = 160;
	const CAROUSEL_SPACING_PX = 6;

	const getSlideHeight = () => {
		if (typeof window === 'undefined') return SLIDE_HEIGHT_PX;
		if (window.innerHeight < 640) return 130;
		if (window.innerHeight < 1024) return 140;
		return 150;
	};

	let slideHeight = $state(getSlideHeight());
	let baseSlidesPerPage = $state(1);
	let slidesPerPage = $derived(Math.min(baseSlidesPerPage, todaysPendingTasks.length || 1));

	onMount(async () => {
		let refreshInterval: number | undefined;
		let handleFocus: () => Promise<void>;

		try {
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

			await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);

			handleFocus = async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			};
			window.addEventListener('focus', handleFocus);

			refreshInterval = window.setInterval(async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			}, 30000);

			return () => {
				window.removeEventListener('resize', updateSlidesPerPage);
				window.removeEventListener('focus', handleFocus);
				if (refreshInterval) window.clearInterval(refreshInterval);
			};
		} catch (err) {
			console.error(err);
			error = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			loading = false;
		}
	});
</script>

{#if loading}
	<div class="flex h-80 items-center justify-center">
		<div class="h-20 w-20 animate-spin rounded-full border-b-2 border-blue-600"></div>
	</div>
{:else if error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
		<h2 class="mb-4 font-semibold">Error loading data</h2>
		<p>{error}</p>
	</div>
{:else if todaysPendingTasks.length === 0}
	<!-- nothing to show -->
{:else}
	<div 
		class="carousel-container w-full"
		style="height: {slideHeight * slidesPerPage + CAROUSEL_SPACING_PX * (slidesPerPage - 1)}px; max-height: calc(100vh - 200px);"
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
										class="task-card mx-auto h-full w-full rounded-lg border border-neutral-600/20 bg-gradient-to-br p-2 shadow-sm transition-shadow duration-200 hover:shadow-md {getPriorityGradient(
											task.taskPriority
										)}"
									>
										<div class="flex h-full flex-col overflow-hidden">
											<!-- Task Title -->
											<h3 class="mb-2 line-clamp-2 text-lg font-bold leading-tight text-gray-900">
												{task.taskName}
											</h3>

											<!-- Status and Project Badges -->
											<div class="mb-auto flex flex-wrap gap-2 overflow-hidden">
												{#if task.taskStatus}
													<span
														class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold flex-shrink-0 {getStatusColor(
															task.taskStatus
														)}"
													>
														{task.taskStatus}
													</span>
												{/if}
												{#if task.projectName}
													<span
														class="inline-flex items-center rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800 min-w-0 max-w-full"
														title={task.projectName}
													>
														<span class="truncate">{task.projectName}</span>
													</span>
												{/if}
											</div>

											<!-- Assignment Info -->
											<div class="mt-3 flex-shrink-0 border-t border-gray-200 pt-3">
												{#if task.architectName}
													<div class="flex items-center gap-2 min-w-0">
														<span class="text-sm text-gray-600 flex-shrink-0">Assigned to:</span>
														<span
															class="truncate font-semibold text-gray-900 min-w-0"
															title={task.architectName}
														>
															{task.architectName}
														</span>
													</div>
												{:else}
													<p class="text-sm italic text-gray-500">Unassigned</p>
												{/if}
											</div>
										</div>
									</div>
								</Carousel.Item>
							{/each}
						</Carousel.ItemGroup>

						<!-- Navigation Controls -->
						<Carousel.Control class="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-2">
							<Carousel.PrevTrigger
								class="pointer-events-auto rounded-full bg-white p-2 shadow-lg opacity-0 transition-all duration-200 hover:scale-110 hover:bg-gray-50 group-hover/carousel:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
								aria-label="Previous task"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-gray-700"
								>
									<path d="m18 15-6-6-6 6" />
								</svg>
							</Carousel.PrevTrigger>

							<Carousel.NextTrigger
								class="pointer-events-auto rounded-full bg-white p-2 shadow-lg opacity-0 transition-all duration-200 hover:scale-110 hover:bg-gray-50 group-hover/carousel:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
								aria-label="Next task"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-gray-700"
								>
									<path d="m6 9 6 6 6-6" />
								</svg>
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

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
