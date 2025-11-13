<script lang="ts">
	import { onMount } from 'svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { getPriorityColor, getPriorityGradient, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';

	let loading = $state(true);
	let error: string | null = $state(null);
	const carouselInstances = new SvelteMap();

	// Subscribe to stores
	let architectsState = $state({ list: [], loading: true, error: null });
	let projectsState = $state({ list: [], loading: true, error: null });
	let tasksState = $state({ list: [], loading: true, error: null });

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
		const projects = projectsState.list;
		const tasks = tasksState.list;

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
		const result = architects.map((architect) => ({
			architectId: architect.architectId,
			firstName: architect.architectName.split(' ')[0] || '',
			lastName: architect.architectName.split(' ').slice(1).join(' ') || '',
			architectName: architect.architectName,
			projects: (projectsByArchitect.get(architect.architectId) || []).map((project) => ({
				...project,
				tasks: project.tasks || []
			})),
			tasks: architect.tasks
		}));

		return result;
	});

	onMount(async () => {
		try {
			loading = true;

			await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);

			// Load tasks with names
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
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

	function initCarousel(node: HTMLElement, architectId: string) {
		const embla = EmblaCarousel(
			node,
			{
				loop: true,
				align: 'center',
				skipSnaps: false,
				dragFree: false
			},
			[
				Autoplay({
					delay: 8000,
					stopOnInteraction: false,
					stopOnMouseEnter: true
				})
			]
		);

		carouselInstances.set(architectId, embla);

		return {
			destroy() {
				embla.destroy();
				carouselInstances.delete(architectId);
			}
		};
	}

	function navigateCarousel(architectId: string, direction: 'prev' | 'next') {
		const embla: EmblaCarouselType = carouselInstances.get(architectId) as EmblaCarouselType;
		if (embla) {
			if (direction === 'prev') {
				embla.scrollPrev();
			} else {
				embla.scrollNext();
			}
		}
	}
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
{:else if architectProjectData.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No architects found.</p>
	</div>
{:else}
	<div class="columns gap-2 [column-width:350px]">
		{#each architectProjectData as architect (architect.architectId)}
			{#if architect}
				<Accordion
					class="group mb-2 inline-block w-full
          break-inside-avoid
          [-webkit-column-break-inside:avoid]
          [page-break-inside:avoid]"
				>
					<AccordionItem
						classes={{
							active:
								'flex h-[50px] flex-row items-center justify-between rounded-t-lg bg-gradient-to-r from-rose-50 to-indigo-100 text-slate-800',
							inactive:
								'flex h-[50px] flex-row items-center justify-between rounded-t-lg bg-gradient-to-r from-rose-50 to-indigo-100 text-slate-800',
							content: 'p-2'
						}}
						open={architect.projects.length > 0}
					>
						{#snippet arrowup()}{/snippet}
						{#snippet arrowdown()}{/snippet}
						{#snippet header()}
							<h2 class="truncate text-2xl font-black">
								{architect.firstName || 'Unassigned projects'}
								{architect.lastName || ''}
							</h2>
							<p class="text-center text-2xl font-bold text-nowrap text-slate-800">
								{architect.projects.length} project{architect.projects.length !== 1 ? 's' : ''}
							</p>
						{/snippet}

						<!-- Project Carousel -->
						{#if architect.projects.length > 0}
							<div class="relative flex flex-1 flex-col">
								<!-- Carousel Container -->
								<div
									class="embla max-h-[540px] overflow-hidden"
									use:initCarousel={architect.architectId}
								>
									<div class="embla__container flex gap-4">
										{#each architect.projects as project (project.projectId)}
											<div
												class="embla__slide
              									max-h-[360px]
              									min-w-full
              									shrink
              									overflow-hidden
              									"
											>
												<!-- Project Card -->
												<div class="flex h-full flex-col">
													<!-- Task Header -->
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
																class="flex
              														min-w-0
              														flex-1
              														items-center
              														gap-2
              														overflow-hidden"
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
													<!-- Tasks -->
													{#if project.tasks && project.tasks.length > 0}
														<div
															class="mt-2 flex flex-1 flex-col overflow-hidden border-t border-gray-200 pt-2 pl-2"
														>
															<h4
																class="mb-3 shrink-0 text-lg font-medium text-gray-900 lg:text-xl"
															>
																Tasks ({project.tasks.length})
															</h4>
															<div class="space-y-2 overflow-y-auto pr-2">
																{#each project.tasks as task (task.taskId)}
																	<div
																		class="flex max-h-[140px] w-full shrink-0 flex-col rounded-2xl border border-neutral-600/20 bg-linear-to-br p-2 duration-200 md:p-3 {getPriorityGradient(
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
																			<p class="lg:text-md mt-2 line-clamp-3 text-sm text-gray-600">
																				{task.taskDescription}
																			</p>
																		{/if}
																	</div>
																{/each}
															</div>
														</div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>

								<!-- Navigation Buttons -->
								{#if architect.projects.length > 1}
									<button
										class="bg-opacity-80 hover:bg-opacity-100 absolute top-1/2 left-2 -translate-y-1/2 transform
									rounded-full bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100"
										onclick={() => navigateCarousel(architect.architectId, 'prev')}
										aria-label="Previous project"
									>
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 19l-7-7 7-7"
											/>
										</svg>
									</button>

									<button
										class="bg-opacity-80 hover:bg-opacity-100 absolute top-1/2 right-2 -translate-y-1/2 transform
									rounded-full bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100"
										onclick={() => navigateCarousel(architect.architectId, 'next')}
										aria-label="Next project"
									>
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 5l7 7-7 7"
											/>
										</svg>
									</button>
								{/if}
							</div>
						{:else}
							<div class="flex flex-1 items-center justify-center p-6">
								<p class="text-center text-gray-500">No projects assigned</p>
							</div>
						{/if}
					</AccordionItem></Accordion
				>
			{/if}
		{/each}
	</div>
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

	/* clamp helper same as carousel */
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
