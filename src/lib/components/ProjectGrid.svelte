<script lang="ts">
	import { onMount } from 'svelte';
	import { Collapsible } from '@ark-ui/svelte/collapsible';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { SvelteMap } from 'svelte/reactivity';
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import {
		getPriorityColor,
		getPriorityGradient,
		getStatusColor,
		getStatusBarColor
	} from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';
	import type { Architect, Project, Task } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CarouselArrowIcon from '$lib/components/CarouselArrowIcon.svelte';

	let loading = $state(true);
	let error: string | null = $state(null);

	// Subscribe to stores
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
	let architectsState = $state({
		list: [] as Architect[],
		loading: true,
		error: null as string | null,
		byId: {} as Record<string, Architect>
	});

	$effect(() => {
		const unsubProjects = projectsStore.subscribe((state) => {
			projectsState = state;
		});
		return unsubProjects;
	});

	$effect(() => {
		const unsubTasks = tasksStore.subscribe((state) => {
			tasksState = state;
		});
		return unsubTasks;
	});

	$effect(() => {
		const unsubArchitects = architectsStore.subscribe((state) => {
			architectsState = state;
		});
		return unsubArchitects;
	});

	// Build projects with their tasks
	let projectsWithTasks = $derived.by(() => {
		// Exclude cancelled & completed projects
		const projects: Project[] = projectsState.list.filter(
			(project: Project) =>
				project.projectStatus !== 'Cancelled' && project.projectStatus !== 'Completed'
		);
		const tasks: Task[] = tasksState.list;

		// Group tasks by project
		const tasksByProject = new SvelteMap<string, typeof tasks>();
		tasks.forEach((task) => {
			const projectId = task.projectId;
			if (!tasksByProject.has(projectId)) {
				tasksByProject.set(projectId, []);
			}
			tasksByProject.get(projectId)!.push(task);
		});

		// Add tasks to each project (only non-cancelled projects)
		const result = projects.map((project: Project) => ({
			...project,
			tasks: tasksByProject.get(project.projectId) || []
		}));

		return result;
	});

	// Slide width scaled up by ~50% from previous defaults.
	// Responsive: smaller on mobile, larger on desktop
	// Mobile: 280px, Tablet: 380px, Desktop: 480px
	const getSlideWidth = () => {
		if (typeof window === 'undefined') return 280;
		if (window.innerWidth < 640) return 280; // mobile (sm breakpoint)
		if (window.innerWidth < 1024) return 380; // tablet
		return 480; // desktop
	};

	let slideWidth = $state(getSlideWidth());
	const SLIDE_MAX_WIDTH_PX = 360;

	let baseSlidesPerPage = $state(1);

	// --- Autoplay delay based on tasks in currently visible project slides ---

	const BASE_AUTOPLAY_DELAY = 1000; // ms
	const PER_TASK_DELAY = 3000; // ms per task on visible slides
	const MIN_AUTOPLAY_DELAY = 1000;
	const MAX_AUTOPLAY_DELAY = 999999;

	// Filter to only projects that have tasks (so slideCount matches visible slides)
	let visibleProjects = $derived.by(() =>
		projectsWithTasks.filter((p) => p && Array.isArray(p.tasks) && p.tasks.length > 0)
	);

	// Update slidesPerPage to use visibleProjects
	let slidesPerPage = $derived(Math.min(baseSlidesPerPage, visibleProjects.length || 1));

	// --- Custom scroll-snap carousel state ---
	let containerRef: HTMLDivElement | undefined = $state();
	let isPaused = $state(false);
	let autoplayTimer: ReturnType<typeof setInterval> | undefined = $state();

	let displayItems = $derived.by((): Array<Project & { tasks: Task[]; _cloneKey: string }> => {
		const items = visibleProjects;
		if (items.length === 0) return [];
		const K = slidesPerPage;
		const N = items.length;
		const result: Array<Project & { tasks: Task[]; _cloneKey: string }> = [];
		for (let i = 0; i < K; i++) {
			const idx = (((N - K + i) % N) + N) % N;
			result.push({ ...items[idx], _cloneKey: `pre_${i}` });
		}
		for (let i = 0; i < N; i++) {
			result.push({ ...items[i], _cloneKey: `orig_${i}` });
		}
		for (let i = 0; i < K; i++) {
			result.push({ ...items[i % N], _cloneKey: `post_${i}` });
		}
		return result;
	});

	function scrollNext() {
		if (!containerRef) return;
		const slide = containerRef.querySelector<HTMLElement>('.carousel-slide');
		if (!slide) return;
		containerRef.scrollBy({ left: slide.offsetWidth + 10, behavior: 'smooth' });
	}

	function scrollPrev() {
		if (!containerRef) return;
		const slide = containerRef.querySelector<HTMLElement>('.carousel-slide');
		if (!slide) return;
		containerRef.scrollBy({ left: -(slide.offsetWidth + 10), behavior: 'smooth' });
	}

	function computeOuterDelay(): number {
		if (!containerRef || visibleProjects.length === 0) return MIN_AUTOPLAY_DELAY;
		const K = slidesPerPage;
		const slide = containerRef.querySelector<HTMLElement>('.carousel-slide');
		if (!slide) return MIN_AUTOPLAY_DELAY;

		const itemWidth = slide.offsetWidth;
		const step = itemWidth + 10;
		const scrollItems = containerRef.scrollLeft / step;
		const firstVisibleIdx = Math.round(scrollItems) - K;

		const N = visibleProjects.length;
		let maxTasks = 0;
		for (let i = 0; i < K; i++) {
			const origIdx = (((firstVisibleIdx + i) % N) + N) % N;
			const project = visibleProjects[origIdx];
			if (project) {
				maxTasks = Math.max(maxTasks, project.tasks?.length ?? 0);
			}
		}
		const dynamicDelay = BASE_AUTOPLAY_DELAY + maxTasks * PER_TASK_DELAY;
		return Math.max(MIN_AUTOPLAY_DELAY, Math.min(MAX_AUTOPLAY_DELAY, dynamicDelay));
	}

	function startAutoplay() {
		stopAutoplay();
		const delay = computeOuterDelay();
		if (delay <= 0) return;
		autoplayTimer = setInterval(() => {
			if (!isPaused) scrollNext();
		}, delay);
	}

	function stopAutoplay() {
		if (autoplayTimer !== undefined) {
			clearInterval(autoplayTimer);
			autoplayTimer = undefined;
		}
	}

	function restartAutoplay() {
		stopAutoplay();
		startAutoplay();
	}

	function onCarouselScroll() {
		if (!containerRef) return;
		const container = containerRef;
		const K = slidesPerPage;
		const N = visibleProjects.length;
		if (N === 0) return;

		const slide = container.querySelector<HTMLElement>('.carousel-slide');
		if (!slide) return;
		const step = slide.offsetWidth + 10;

		const firstVisibleIdx = Math.round(container.scrollLeft / step);

		if (firstVisibleIdx >= K + N) {
			container.scrollLeft = K * step;
		} else if (firstVisibleIdx < K) {
			container.scrollLeft = (K + N - 1) * step;
		}

		restartAutoplay();
	}

	onMount(() => {
		loading = true;

		const updateSlidesPerPage = () => {
			const width = window.innerWidth;
			slideWidth = Math.min(getSlideWidth(), SLIDE_MAX_WIDTH_PX);
			baseSlidesPerPage = Math.max(1, Math.floor(width / slideWidth));
		};

		// Set initial value
		updateSlidesPerPage();

		// Update on resize
		window.addEventListener('resize', updateSlidesPerPage);

		// Detect zoom using visualViewport
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', updateSlidesPerPage);
		}

		// Refresh data when window regains focus
		const handleFocus = async () => {
			await Promise.all([architectsStore.refresh(), projectsStore.refresh(), tasksStore.refresh()]);
			// Re-enrich tasks after refresh
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
		};
		window.addEventListener('focus', handleFocus);

		// async load
		(async () => {
			try {
				await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);
				// Enrich tasks with architect and project names
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);

				// Set initial scroll to first original item and start autoplay
				requestAnimationFrame(() => {
					if (containerRef) {
						const slide = containerRef.querySelector<HTMLElement>('.carousel-slide');
						if (slide) {
							const step = slide.offsetWidth + 10;
							containerRef.scrollLeft = slidesPerPage * step;
						}
					}
					startAutoplay();
				});
			} catch (err) {
				console.error('Error loading data:', err);
				if (err instanceof Error) {
					error = err.message;
				} else {
					error = 'Unknown error occurred';
				}
			} finally {
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('resize', updateSlidesPerPage);
			stopAutoplay();
		};
	});
</script>

{#if loading}
	<LoadingSpinner />
{:else if error}
	<ErrorState message={error} />
{:else if projectsWithTasks.length === 0}
	<EmptyState message="No projects found." />
{:else}
	<div class="carousel-root group/carousel relative max-w-full overflow-hidden pb-14">
		<div
			bind:this={containerRef}
			onscroll={onCarouselScroll}
			onpointerenter={() => (isPaused = true)}
			onpointerleave={() => (isPaused = false)}
			class="flex gap-[10px] overflow-x-auto"
			style="scroll-snap-type: x mandatory; scrollbar-width: none;"
		>
			{#each displayItems as project (project._cloneKey)}
				<div
					class="carousel-slide flex-none"
					style="scroll-snap-align: start; width: calc((100% - {(slidesPerPage - 1) *
						10}px) / {slidesPerPage});"
				>
					{#if project && project.tasks.length > 0}
						<Collapsible.Root
							defaultOpen
							class="group/card h-full w-full shrink-0 rounded-xl border border-gray-200"
						>
							<Collapsible.Trigger
								class="flex h-10 w-full min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-t-lg bg-amber-200 bg-linear-to-r from-rose-50 to-indigo-100 px-4 text-slate-800"
							>
								<div class="flex flex-row items-center justify-start gap-2 truncate">
									<div
										class="min-h-4 min-w-4 shrink-0 rounded-full {getPriorityColor(
											project.projectPriority
										)}"
									></div>
									<h2 class="truncate text-2xl font-black">
										{project.projectName}
									</h2>
								</div>
								<p class="ml-2 text-center text-2xl font-bold text-nowrap text-slate-800">
									{project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}
								</p>
							</Collapsible.Trigger>
							<Collapsible.Content class="m-2">
								<!-- Project Content -->
								<div class="flex flex-col">
									<!-- Project Details -->
									<div class="shrink-0">
										<div class="flex min-w-0 flex-col gap-2">
											<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
												{#if project.projectStatus}
													<span
														class="shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-bold whitespace-nowrap lg:text-lg {getStatusColor(
															project.projectStatus
														)}"
													>
														{project.projectStatus}
													</span>
												{/if}
											</div>

											<div
												class="flex items-center justify-between gap-2 text-lg font-medium text-gray-900 lg:text-xl"
											>
												<span>Start: {formatDate(project.projectStartDate)}</span>
												<span>Due: {formatDate(project.projectDueDate)}</span>
											</div>
										</div>

										{#if project.projectDescription}
											<p class="text-md mt-2 text-gray-600 lg:text-lg">
												{project.projectDescription}
											</p>
										{/if}
									</div>

									<!-- Tasks Section: Carousel where each task is a slide -->
									{#if project.tasks.length > 0}
										<div
											class="mt-1 flex w-full flex-1 flex-col overflow-hidden border-t border-gray-200 pt-2"
										>
											<Carousel.Root
												defaultPage={0}
												slideCount={project.tasks.length}
												autoplay={{ delay: PER_TASK_DELAY }}
												loop
												allowMouseDrag
												spacing="10px"
												class="carousel-root w-full"
											>
												<Carousel.Context>
													{#snippet render(api)}
														<Carousel.ItemGroup
															onpointerover={() => api().pause()}
															onpointerleave={() => api().play()}
														>
															{#each project.tasks as task, tIndex (task.taskId)}
																<!-- make each inner-item occupy full width of its carousel viewport -->
																<Carousel.Item index={tIndex} class="w-full flex-none">
																	<div
																		class="flex h-full min-h-25 w-full overflow-hidden rounded-2xl border border-neutral-600/20 bg-linear-to-br duration-200 {getPriorityGradient(
																			task.taskPriority
																		)}"
																	>
																		{#if task.taskStatus}
																			<div
																				class="w-[10px] shrink-0 {getStatusBarColor(
																					task.taskStatus
																				)}"
																			></div>
																			<div class="w-2.5 shrink-0"></div>
																		{/if}
																		<div
																			class="flex min-w-0 flex-col justify-between px-3 py-1 md:py-2"
																		>
																			<div class="min-w-0 flex-1">
																				<p
																					class="text-md min-w-0 flex-1 items-center truncate font-bold text-gray-900 md:text-lg xl:text-xl"
																				>
																					{task.taskName}
																				</p>
																			</div>

																			{#if task.taskDescription}
																				<p
																					class="lg:text-md mx-1 line-clamp-3 text-sm text-gray-600 xl:text-base"
																				>
																					{task.taskDescription}
																				</p>
																			{/if}

																			<div
																				class="text-md mt-1 flex items-center justify-between gap-2 text-gray-800 lg:text-lg"
																			>
																				<span>Start: {formatDate(task.taskStartDate)}</span>
																				<span>Due: {formatDate(task.taskDueDate)}</span>
																			</div>

																			<!-- Assigned to (kept) -->
																			<div class="mt-1 border-t border-gray-200">
																				{#if task.architectName}
																					<p class="text-lg text-gray-700 xl:text-xl">
																						Assigned to:
																						<span class="font-bold text-gray-900"
																							>{task.architectName}</span
																						>
																					</p>
																				{:else}
																					<p
																						class="text-xs text-gray-500 italic md:text-sm xl:text-base"
																					>
																						Unassigned
																					</p>
																				{/if}
																			</div>
																		</div>
																	</div>
																</Carousel.Item>
															{/each}
														</Carousel.ItemGroup>
													{/snippet}
												</Carousel.Context>
												{#if project.tasks.length > 1}
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
										</div>
									{:else}
										<div class="flex flex-1 items-center justify-center p-6">
											<p class="text-center text-gray-500">No tasks assigned to this project</p>
										</div>
									{/if}
								</div>
							</Collapsible.Content>
						</Collapsible.Root>
					{/if}
				</div>
			{/each}
		</div>

		<!-- outer navigation controls -->
		<div class="absolute right-0 bottom-0 left-0 flex items-center justify-center gap-4 py-4">
			<button
				onclick={scrollPrev}
				class="rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-all duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
			>
				<CarouselArrowIcon direction="left" />
			</button>
			<button
				onclick={scrollNext}
				class="rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-all duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
			>
				<CarouselArrowIcon direction="right" />
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes slideDown {
		from {
			height: 0;
		}
		to {
			height: var(--height);
		}
	}

	@keyframes slideUp {
		from {
			height: var(--height);
		}
		to {
			height: 0;
		}
	}
	[data-scope='collapsible'][data-part='content'][data-state='open'] {
		animation: slideDown 250ms;
	}

	[data-scope='collapsible'][data-part='content'][data-state='closed'] {
		animation: slideUp 200ms;
	}
</style>
