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
		const unsubArchitects = architectsStore.subscribe((state) => {
			architectsState = state;
		});
		return unsubArchitects;
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

	// Build hierarchical data structure
	let architectProjectData = $derived.by(() => {
		const architects = architectsState.list;

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

		// Group projects by architect
		const projectsByArchitect = new SvelteMap<string, typeof projects>();
		projects.forEach((project) => {
			// Find tasks for this project to determine architect
			const projectTasks = tasksByProject.get(project.projectId) || [];
			projectTasks.forEach((task) => {
				const architectId = task.architectId;
				if (architectId) {
					if (!projectsByArchitect.has(architectId)) {
						projectsByArchitect.set(architectId, []);
					}
					// Only add project once per architect
					const existingProjects = projectsByArchitect.get(architectId)!;
					if (!existingProjects.find((p) => p.projectId === project.projectId)) {
						existingProjects.push({
							...project,
							tasks: projectTasks.filter((t) => t.architectId === architectId)
						});
					}
				}
			});
		});

		// Build final structure
		const result = architects.map(
			(architect: {
				architectId: string;
				firstName: string;
				lastName: string;
				architectName: string;
				projects: Project[];
				tasks: Task[];
			}) => ({
				architectId: architect.architectId,
				firstName: architect.architectName.split(' ')[0] || '',
				lastName: architect.architectName.split(' ').slice(1).join(' ') || '',
				architectName: architect.architectName,
				projects: (projectsByArchitect.get(architect.architectId) || []).map((project) => ({
					...project,
					tasks: project.tasks || []
				})),
				tasks: architect.tasks
			})
		);

		return result;
	});

	// Filter to only architects that actually have projects (so slideCount matches)
	let visibleArchitects = $derived.by(() =>
		architectProjectData.filter((a) => a && Array.isArray(a.projects) && a.projects.length > 0)
	);

	// responsive outer carousel styling

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

	let slidesPerPage = $derived(Math.min(baseSlidesPerPage, visibleArchitects.length || 1));

	// --- Inner + outer autoplay delays based on tasks ---

	// Inner (project) carousels – per architect
	const INNER_BASE_DELAY = 1000; // ms
	const INNER_PER_TASK_DELAY = 3000; // ms per task
	const INNER_MIN_DELAY = 1000;
	const INNER_MAX_DELAY = 999999;

	// Outer (architect) carousel – will use sum of inner delays for visible cards
	const OUTER_MIN_DELAY = 1000;
	const OUTER_MAX_DELAY = 999999;

	// Per-architect inner carousel delays, based on total tasks in that architect's projects
	let innerCarouselDelays = $derived.by(() => {
		const delays: Record<string, number> = {};

		for (const architect of architectProjectData) {
			const totalTasksForArchitect = (architect.projects ?? []).reduce(
				(sum, project) => sum + (project.tasks?.length ?? 0),
				0
			);

			const rawDelay = INNER_BASE_DELAY + totalTasksForArchitect * INNER_PER_TASK_DELAY;

			const clampedDelay = Math.max(INNER_MIN_DELAY, Math.min(INNER_MAX_DELAY, rawDelay));

			delays[architect.architectId] = clampedDelay;
		}

		return delays;
	});

	// --- Custom scroll-snap carousel state ---
	let containerRef: HTMLDivElement | undefined = $state();
	let isPaused = $state(false);
	let autoplayTimer: ReturnType<typeof setInterval> | undefined = $state();

	let displayItems = $derived.by(
		(): Array<Architect & { projects: (Project & { tasks: Task[] })[]; _cloneKey: string }> => {
			const items = visibleArchitects;
			if (items.length === 0) return [];
			const K = slidesPerPage;
			const N = items.length;
			const result: Array<
				Architect & { projects: (Project & { tasks: Task[] })[]; _cloneKey: string }
			> = [];
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
		}
	);

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
		if (!containerRef || visibleArchitects.length === 0) return OUTER_MIN_DELAY;
		const K = slidesPerPage;
		const N = visibleArchitects.length;
		const slide = containerRef.querySelector<HTMLElement>('.carousel-slide');
		if (!slide) return OUTER_MIN_DELAY;

		const itemWidth = slide.offsetWidth;
		const step = itemWidth + 10;
		const scrollItems = containerRef.scrollLeft / step;
		const firstVisibleOrigIdx = Math.round(scrollItems) - K;

		let cumulativeDelay = 0;
		for (let i = 0; i < K; i++) {
			const origIdx = (((firstVisibleOrigIdx + i) % N) + N) % N;
			const architect = visibleArchitects[origIdx];
			if (architect) {
				cumulativeDelay += innerCarouselDelays[architect.architectId] ?? INNER_BASE_DELAY;
			}
		}
		return Math.max(OUTER_MIN_DELAY, Math.min(OUTER_MAX_DELAY, cumulativeDelay));
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
		const N = visibleArchitects.length;
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

	type AutoScrollOptions = {
		speed?: number; // pixels per frame
		pauseOnHover?: boolean;
	};

	function autoScrollY(node: HTMLElement, options: AutoScrollOptions = {}) {
		let frameId: number | null = null;
		let direction: 1 | -1 = 1; // 1 = down, -1 = up
		let isHovered = false;
		let isPressed = false;

		const speed = options.speed ?? 30; // px/sec
		const pauseOnHover = options.pauseOnHover ?? true;
		const EDGE_EPSILON = 1; // px tolerance so we don't rely on exact equality

		const handleEnter = () => {
			if (pauseOnHover) isHovered = true;
		};
		const handleLeave = () => {
			if (pauseOnHover) isHovered = false;
		};
		const handleDown = () => {
			isPressed = true;
		};
		const handleUp = () => {
			isPressed = false;
		};

		if (pauseOnHover) {
			node.addEventListener('pointerenter', handleEnter);
			node.addEventListener('pointerleave', handleLeave);
		}
		node.addEventListener('pointerdown', handleDown);
		node.addEventListener('pointerup', handleUp);
		node.addEventListener('pointercancel', handleUp);

		let lastTime: number | null = null;

		const loop = (time: number) => {
			if (lastTime == null) lastTime = time;
			const dt = (time - lastTime) / 1000; // seconds since last frame
			lastTime = time;

			const maxScroll = node.scrollHeight - node.clientHeight;

			if (!isHovered && !isPressed && maxScroll > 0) {
				// move based on time delta, not a fixed px/frame
				const delta = direction * speed * dt;
				node.scrollTop += delta;

				// bottom reached (within epsilon) → go up
				if (node.scrollTop >= maxScroll - EDGE_EPSILON) {
					node.scrollTop = maxScroll;
					direction = -1;
				}
				// top reached (within epsilon) → go down
				else if (node.scrollTop <= EDGE_EPSILON) {
					node.scrollTop = 0;
					direction = 1;
				}
			}

			frameId = requestAnimationFrame(loop);
		};

		frameId = requestAnimationFrame(loop);

		return {
			destroy() {
				if (frameId !== null) cancelAnimationFrame(frameId);
				if (pauseOnHover) {
					node.removeEventListener('pointerenter', handleEnter);
					node.removeEventListener('pointerleave', handleLeave);
				}
				node.removeEventListener('pointerdown', handleDown);
				node.removeEventListener('pointerup', handleUp);
				node.removeEventListener('pointercancel', handleUp);
			}
		};
	}

	onMount(() => {
		loading = true;

		const updateSlidesPerPage = () => {
			if (typeof window === 'undefined') return;
			const width = window.innerWidth;
			slideWidth = Math.min(getSlideWidth(), SLIDE_MAX_WIDTH_PX);
			baseSlidesPerPage = Math.max(1, Math.floor(width / slideWidth));
		};

		// Set initial value
		updateSlidesPerPage();

		// Update on resize
		window.addEventListener('resize', updateSlidesPerPage);

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
				// Load tasks with names
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
			window.removeEventListener('resize', updateSlidesPerPage);
			window.removeEventListener('focus', handleFocus);
			stopAutoplay();
		};
	});
</script>

{#if loading}
	<LoadingSpinner />
{:else if error}
	<ErrorState message={error} />
{:else if visibleArchitects.length === 0}
	<EmptyState message="No architects found." />
{:else}
	<div class="carousel-root group/carousel relative max-w-full pb-14">
		<div
			bind:this={containerRef}
			onscroll={onCarouselScroll}
			onpointerenter={() => (isPaused = true)}
			onpointerleave={() => (isPaused = false)}
			class="flex gap-[10px] overflow-x-auto"
			style="scroll-snap-type: x mandatory; scrollbar-width: none;"
		>
			{#each displayItems as architect (architect._cloneKey)}
				<!-- Architect card is a slide -->
				<div
					class="carousel-slide flex-none"
					style="scroll-snap-align: start; width: calc((100% - {(slidesPerPage - 1) *
						10}px) / {slidesPerPage});"
				>
					<Collapsible.Root
						defaultOpen
						class="group/card w-shrink-0 rounded-xl border border-gray-200"
					>
						<Collapsible.Trigger
							class="flex h-10 w-full min-w-0 flex-1 flex-row items-center justify-between gap-2 truncate rounded-t-lg bg-amber-200 bg-linear-to-r from-rose-50 to-indigo-100 px-4 text-2xl font-black text-slate-800"
						>
							<h2 class="truncate">
								{architect.architectName || 'Unassigned projects'}
							</h2>
							<p class="text-center text-2xl font-bold text-nowrap text-slate-800">
								{architect.projects.length} project{architect.projects.length !== 1 ? 's' : ''}
							</p>
						</Collapsible.Trigger>

						<Collapsible.Content class="m-2">
							<!-- INNER CAROUSEL: projects for this architect -->
							<div class="relative flex flex-1 flex-col">
								<Carousel.Root
									defaultPage={0}
									slideCount={architect.projects.length}
									autoplay={{
										delay: innerCarouselDelays[architect.architectId]
											? innerCarouselDelays[architect.architectId] / architect.projects.length
											: INNER_BASE_DELAY
									}}
									loop
									allowMouseDrag
									spacing="10px"
									class="carousel-root"
								>
									<Carousel.Context>
										{#snippet render(api)}
											<Carousel.ItemGroup
												onpointerover={() => api().pause()}
												onpointerleave={() => api().play()}
											>
												{#each architect.projects as project, pIndex (project.projectId)}
													<!-- Project slide fills inner carousel viewport -->
													<Carousel.Item index={pIndex} class="w-full flex-none">
														<!-- Project Card -->
														<div class="flex h-full flex-col">
															<!-- Project Header -->
															<div class="shrink-0">
																{#if project.projectName}
																	<div
																		class="justify-left mb-3 flex w-full flex-row items-center gap-2"
																	>
																		<div
																			class="min-h-4 min-w-4 shrink-0 rounded-full {getPriorityColor(
																				project.projectPriority
																			)}"
																		></div>
																		<h3
																			class="truncate text-xl font-semibold text-gray-900 lg:text-2xl"
																		>
																			{project.projectName}
																		</h3>
																	</div>
																{/if}
																<div class="flex min-w-0 flex-col gap-2">
																	<div
																		class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
																	>
																		{#if project.projectStatus}
																			<span
																				class="mb-2 shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-bold whitespace-nowrap lg:text-lg {getStatusColor(
																					project.projectStatus
																				)}"
																			>
																				{project.projectStatus}
																			</span>
																		{/if}
																	</div>

																	<!-- <div
																		   class="mb-2 flex items-center justify-between gap-2 text-lg font-medium text-gray-900 lg:text-xl"
																	     >
																		   <span>Start: {formatDate(project.projectStartDate)}</span>
																		   <span>Due: {formatDate(project.projectDueDate)}</span>
																	     </div> -->
																</div>

																{#if project.projectDescription}
																	<p class="text-md mb-2 line-clamp-3 text-gray-600 lg:text-xl">
																		{project.projectDescription}
																	</p>
																{/if}
															</div>

															<!-- Tasks list -->
															{#if project.tasks && project.tasks.length > 0}
																<div
																	use:autoScrollY={{ speed: 75, pauseOnHover: true }}
																	class="flex max-h-96 flex-col space-y-1 overflow-y-auto border-t border-gray-200 pr-0.5"
																>
																	<h4 class="mt-1 shrink-0 text-2xl font-bold text-gray-900">
																		Tasks ({project.tasks.length})
																	</h4>
																	{#each project.tasks as task (task.taskId)}
																		<div
																			class="flex min-h-fit w-full rounded-2xl border border-neutral-600/20 bg-linear-to-br duration-200 {getPriorityGradient(
																				task.taskPriority
																			)}"
																		>
																			{#if task.taskStatus}
																				<div
																					class="w-[10px] shrink-0 rounded-l-2xl {getStatusBarColor(
																						task.taskStatus
																					)}"
																				></div>
																				<div class="w-2.5 shrink-0"></div>
																			{/if}
																			<div class="flex min-w-0 flex-col px-3 py-2 md:py-3">
																				<div class="min-w-0">
																					<p
																						class="text-md font-bold text-gray-900 lg:text-lg xl:text-xl"
																					>
																						{task.taskName}
																					</p>
																				</div>
																				{#if task.taskDescription}
																					<p
																						class="lg:text-md mx-1 mb-1 text-sm text-gray-600 xl:text-base"
																					>
																						{task.taskDescription}
																					</p>
																				{/if}
																			</div>
																		</div>
																	{/each}
																</div>
															{/if}
														</div>
													</Carousel.Item>
												{/each}
											</Carousel.ItemGroup>
										{/snippet}
									</Carousel.Context>

									{#if architect.projects.length > 1}
										<!-- Inner navigation controls -->
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
						</Collapsible.Content>
					</Collapsible.Root>
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
