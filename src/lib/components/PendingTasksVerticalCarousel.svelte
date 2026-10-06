<script lang="ts">
	// (All imports, stores, derived state, onMount logic, etc.)
	// --------------------------------------------------------
	import { onMount } from 'svelte';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { getPriorityGradient, getStatusBarColor } from '$lib/utils/colorUtils';

	import { architectsStore, projectsStore, tasksStore, viewportStore } from '$lib/stores';
	import { SvelteDate } from 'svelte/reactivity';
	import type { Architect, Project, Task } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import CarouselArrowIcon from '$lib/components/CarouselArrowIcon.svelte';

	let loading = $state(true);
	let error: string | null = $state(null);

	// Mirrors the store state shapes (`error` is optional there, so it must be optional here too)
	type CarouselEntityState<T> = {
		list: T[];
		loading: boolean;
		error?: string | null;
		byId: Record<string, T>;
	};

	let architectsState = $state<CarouselEntityState<Architect>>({
		list: [],
		loading: true,
		error: null,
		byId: {}
	});
	let projectsState = $state<CarouselEntityState<Project>>({
		list: [],
		loading: true,
		error: null,
		byId: {}
	});
	let tasksState = $state<CarouselEntityState<Task>>({
		list: [],
		loading: true,
		error: null,
		byId: {}
	});

	$effect(() => architectsStore.subscribe((s) => (architectsState = s)));
	$effect(() => projectsStore.subscribe((s) => (projectsState = s)));
	$effect(() => tasksStore.subscribe((s) => (tasksState = s)));

	let viewport = $state({
		width: 1920,
		height: 1080,
		scale: 1,
		layoutWidth: 1920,
		layoutHeight: 1080
	});
	$effect(() => viewportStore.subscribe((s) => (viewport = s)));

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

	const SLIDE_MAX_HEIGHT_PX = 220;
	const CAROUSEL_SPACING_PX = 8;

	// Font sizes are driven by viewport WIDTH (lg/xl breakpoints) while the slide height is driven
	// by viewport HEIGHT, so the slide must also be tall enough for the text of the active width
	// breakpoint — otherwise a short viewport with `xl` text clips the card content.
	// Footer height + padding + 2 title lines were measured at 179px for the `xl` sizes
	// (at 1280x600 with a 170px slide the footer overflowed the card by 9px), hence the floors.
	const MIN_SLIDE_HEIGHT_XL_PX = 185; // text-3xl title, text-lg footer (width >= 1280)
	const MIN_SLIDE_HEIGHT_LG_PX = 150; // text-2xl title, text-base footer (width >= 1024)

	const getSlideHeight = (h: number, w: number) => {
		const byHeight = h < 640 ? 170 : h < 1024 ? 195 : h < 1440 ? 205 : 220;
		const byWidth = w >= 1280 ? MIN_SLIDE_HEIGHT_XL_PX : MIN_SLIDE_HEIGHT_LG_PX;
		return Math.max(byHeight, byWidth);
	};

	let slideHeight = $derived(
		Math.min(getSlideHeight(viewport.layoutHeight, viewport.layoutWidth), SLIDE_MAX_HEIGHT_PX)
	);

	let baseSlidesPerPage = $derived.by(() => {
		const availableHeight = viewport.layoutHeight - viewport.layoutHeight * 0.3;
		return Math.max(
			1,
			Math.floor((availableHeight + CAROUSEL_SPACING_PX) / (slideHeight + CAROUSEL_SPACING_PX))
		);
	});
	let slidesPerPage = $derived(Math.min(baseSlidesPerPage, todaysPendingTasks.length || 1));

	onMount(() => {
		loading = true;

		// Refresh data when window regains focus
		const handleFocus = async () => {
			await Promise.all([architectsStore.refresh(), projectsStore.refresh(), tasksStore.refresh()]);
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
		};
		window.addEventListener('focus', handleFocus);

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
			window.removeEventListener('focus', handleFocus);
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
			CAROUSEL_SPACING_PX * (slidesPerPage - 1)}px; --slide-h: {slideHeight}px;"
	>
		<Carousel.Root
			orientation="vertical"
			defaultPage={0}
			slideCount={todaysPendingTasks.length}
			autoplay={{ delay: 7000 }}
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
							class="carousel-track flex h-full w-full min-w-0 flex-col"
						>
							{#each todaysPendingTasks as task, index (task.taskId)}
								<Carousel.Item
									{index}
									class="carousel-item w-full flex-shrink-0"
									style="height: {slideHeight}px; min-height: {slideHeight}px; max-height: {slideHeight}px;"
								>
									<div
										class="task-card mx-auto flex h-full w-full min-w-0 overflow-hidden rounded-lg border border-neutral-600/20 bg-gradient-to-br shadow-sm transition-shadow duration-200 hover:shadow-md {getPriorityGradient(
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
												class="mb-2 line-clamp-2 shrink-0 text-lg leading-tight font-bold text-gray-900 lg:text-2xl xl:text-3xl"
											>
												{task.taskName}
											</h3>

											<!-- Project Badge (status indicated by colored left bar) -->
											{#if task.projectName}
												<div class="mb-auto flex shrink-0 flex-wrap gap-2 overflow-hidden">
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

	/*
	 * zag-js renders the item group as `display: grid` with `gridAutoFlow: row`, which leaves the
	 * implicit column sized to `auto` (max-content of the widest slide). The `w-full` slides then
	 * resolve against that oversized track and spill out of the 20%-wide column, cropping the card
	 * on the right. Pinning the implicit column to the container width keeps every slide inside.
	 *
	 * The row size is pinned to the slide height for the same reason: zag-js derives it from the
	 * measured container height (`calc(100% / slidesPerPage - spacing * (n - 1) / n)`), so any clamp
	 * on the container makes the rows shorter than the slides, the slides overflow their rows and
	 * the 8px gap between cards disappears. `--slide-h` is set by the container above.
	 *
	 * `:global` is required: the class is forwarded through the Ark UI `Carousel.ItemGroup`
	 * component, so Svelte's scoping hash is never added to the rendered element.
	 */
	:global(.carousel-track) {
		--slide-item-size: var(--slide-h);
		grid-auto-columns: minmax(0, 100%);
		min-width: 0;
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
