<script lang="ts">
	import { onMount } from 'svelte';
	import { Collapsible } from '@ark-ui/svelte/collapsible';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { SvelteMap } from 'svelte/reactivity';
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { getPriorityColor, getPriorityGradient, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';
	import type { Project, Task } from '$lib/types';

	let loading = $state(true);
	let error: string | null = $state(null);

	// Subscribe to stores
	let architectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let projectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let tasksState = $state({ list: [], loading: true, error: null, byId: {} });

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

	// --- responsive outer carousel styling (same as your "styling" example) ---

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

	let currentPage = $state(0);

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

	// Outer carousel delay = sum of inner delays for currently visible architect cards
	let outerAutoplayDelay = $derived.by(() => {
		const totalArchitects = visibleArchitects.length;
		if (totalArchitects === 0) return OUTER_MIN_DELAY;

		const startIndex = currentPage * slidesPerPage;
		const endIndex = Math.min(startIndex + slidesPerPage, totalArchitects);

		const currentlyVisibleArchitects = visibleArchitects.slice(startIndex, endIndex);

		const cumulativeInnerDelay = currentlyVisibleArchitects.reduce((sum, architect) => {
			const innerDelay = innerCarouselDelays[architect.architectId] ?? INNER_BASE_DELAY;
			return sum + innerDelay;
		}, 0);

		// Clamp outer delay so it doesn't get silly
		const clamped = Math.max(OUTER_MIN_DELAY, Math.min(OUTER_MAX_DELAY, cumulativeInnerDelay));

		return clamped;
	});

	type AutoScrollOptions = {
		speed?: number; // pixels per frame
		pauseOnHover?: boolean;
	};

	function autoScrollY(node: HTMLElement, options: AutoScrollOptions = {}) {
		let frameId: number | null = null;
		let direction: 1 | -1 = 1; // 1 = down, -1 = up
		let isHovered = false;

		const speed = options.speed ?? 30; // px/sec
		const pauseOnHover = options.pauseOnHover ?? true;
		const EDGE_EPSILON = 1; // px tolerance so we don't rely on exact equality

		const handleEnter = () => {
			if (pauseOnHover) isHovered = true;
		};
		const handleLeave = () => {
			if (pauseOnHover) isHovered = false;
		};

		if (pauseOnHover) {
			node.addEventListener('pointerenter', handleEnter);
			node.addEventListener('pointerleave', handleLeave);
		}

		let lastTime: number | null = null;

		const loop = (time: number) => {
			if (lastTime == null) lastTime = time;
			const dt = (time - lastTime) / 1000; // seconds since last frame
			lastTime = time;

			const maxScroll = node.scrollHeight - node.clientHeight;

			if (!isHovered && maxScroll > 0) {
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
			}
		};
	}

	onMount(async () => {
		try {
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

			await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);

			// Load tasks with names
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);

			// Refresh data when window regains focus
			const handleFocus = async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				// Re-enrich tasks after refresh
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			};
			window.addEventListener('focus', handleFocus);

			// Optional: Auto-refresh every 30 seconds
			const refreshInterval = setInterval(async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				// Re-enrich tasks after auto-refresh
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			}, 30000); // 30 seconds
			// Cleanup
			return () => {
				window.removeEventListener('resize', updateSlidesPerPage);
				clearInterval(refreshInterval);
			};
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
	});
</script>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<div class="h-16 w-16 animate-spin rounded-full border-b-2 border-blue-600"></div>
	</div>
{:else if error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
		<h2 class="mb-2 font-semibold">Error loading data</h2>
		<p>{error}</p>
	</div>
{:else if visibleArchitects.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No architects found.</p>
	</div>
{:else}
	<Carousel.Root
		defaultPage={0}
		page={currentPage}
		onPageChange={(details) => (currentPage = details.page)}
		slideCount={visibleArchitects.length}
		autoplay={{ delay: outerAutoplayDelay }}
		loop
		allowMouseDrag
		spacing="10px"
		class="group/carousel relative max-w-full overflow-hidden"
		{slidesPerPage}
	>
		<Carousel.Context>
			{#snippet render(api)}
				<Carousel.ItemGroup onpointerover={() => api().pause()} onpointerleave={() => api().play()}>
					{#each visibleArchitects as architect, index (architect.architectId)}
						<!-- Architect card is a slide -->
						<Carousel.Item
							{index}
							style="flex: 0 0 calc(100% / {slidesPerPage}); max-width: {SLIDE_MAX_WIDTH_PX}px;"
							class="flex-none"
						>
							<Collapsible.Root
								defaultOpen
								class="group w-shrink-0 rounded-xl border border-gray-200"
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
											class="group/carousel relative max-w-full overflow-hidden"
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
																						class="shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-bold whitespace-nowrap lg:text-lg {getStatusColor(
																							project.projectStatus
																						)}"
																					>
																						{project.projectStatus}
																					</span>
																				{/if}
																			</div>

																			<div
																				class="mb-2 flex items-center justify-between gap-2 text-lg font-medium text-gray-900 lg:text-xl"
																			>
																				<span>Start: {formatDate(project.projectStartDate)}</span>
																				<span>Due: {formatDate(project.projectDueDate)}</span>
																			</div>
																		</div>

																		{#if project.projectDescription}
																			<p class="text-md mb-2 truncate text-gray-600 lg:text-xl">
																				{project.projectDescription}
																			</p>
																		{/if}
																	</div>

																	<!-- Tasks list -->
																	{#if project.tasks && project.tasks.length > 0}
																		<div
																			use:autoScrollY={{ speed: 75, pauseOnHover: true }}
																			class="flex max-h-60 flex-1 flex-col space-y-1 overflow-hidden overflow-y-auto border-t border-gray-200 pr-0.5"
																		>
																			<h4
																				class="mt-1 shrink-0 text-lg font-medium text-gray-900 lg:text-xl"
																			>
																				Tasks ({project.tasks.length})
																			</h4>
																			{#each project.tasks as task (task.taskId)}
																				<div
																					class="flex h-auto max-h-20 w-full flex-col rounded-2xl border border-neutral-600/20 bg-linear-to-br p-2 duration-200 md:p-3 {getPriorityGradient(
																						task.taskPriority
																					)}"
																				>
																					<div class="flex items-center justify-between gap-2">
																						<div class="min-w-0 flex-1">
																							<p
																								class="text-md truncate font-medium text-gray-900 lg:text-lg"
																							>
																								{task.taskName}
																							</p>
																						</div>
																						{#if task.taskStatus}
																							<span
																								class="lg:text-md ml-2 inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium {getStatusColor(
																									task.taskStatus
																								)}"
																							>
																								{task.taskStatus}
																							</span>
																						{/if}
																					</div>

																					{#if task.taskDescription}
																						<p
																							class="lg:text-md line-clamp-3 text-sm text-gray-600"
																						>
																							{task.taskDescription}
																						</p>
																					{/if}
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

											<!-- Inner navigation controls -->
											<Carousel.Control class="pointer-events-none absolute inset-0">
												<Carousel.PrevTrigger
													class="pointer-events-auto absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-opacity duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="24"
														height="24"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														class="text-gray-800"
													>
														<path d="m15 18-6-6 6-6" />
													</svg>
												</Carousel.PrevTrigger>

												<Carousel.NextTrigger
													class="pointer-events-auto absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-opacity duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="24"
														height="24"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														class="text-gray-800"
													>
														<path d="m9 18 6-6-6-6" />
													</svg>
												</Carousel.NextTrigger>
											</Carousel.Control>
										</Carousel.Root>
									</div>
								</Collapsible.Content>
							</Collapsible.Root>
						</Carousel.Item>
					{/each}
				</Carousel.ItemGroup>
			{/snippet}
		</Carousel.Context>

		<!-- OUTER navigation controls -->
		<Carousel.Control class="pointer-events-none absolute inset-0">
			<Carousel.PrevTrigger
				class="pointer-events-auto absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-opacity duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-gray-800"
				>
					<path d="m15 18-6-6 6-6" />
				</svg>
			</Carousel.PrevTrigger>

			<Carousel.NextTrigger
				class="pointer-events-auto absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-opacity duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-gray-800"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</Carousel.NextTrigger>
		</Carousel.Control>
	</Carousel.Root>
{/if}

<style>
	/* Custom scrollbar for subtasks */
	.overflow-y-auto::-webkit-scrollbar {
		width: 4px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 2px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 2px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: #cbd5f9;
	}

	/* clamp helper */
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
