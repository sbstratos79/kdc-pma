<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Collapsible } from '@ark-ui/svelte/collapsible';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { SvelteMap } from 'svelte/reactivity';
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { getPriorityColor, getPriorityGradient, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';

	let loading = $state(true);
	let error: string | null = $state(null);

	// Subscribe to stores
	let projectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let tasksState = $state({ list: [], loading: true, error: null, byId: {} });
	let architectsState = $state({ list: [], loading: true, error: null, byId: {} });

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

		// Add tasks to each project
		const result = projects.map((project) => ({
			...project,
			tasks: tasksByProject.get(project.projectId) || []
		}));

		return result;
	});

	onMount(async () => {
		try {
			loading = true;

			await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);

			// Enrich tasks with architect and project names
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
				window.removeEventListener('focus', handleFocus);
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
{:else if projectsWithTasks.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No projects found.</p>
	</div>
{:else}
	<div class="flex flex-row flex-wrap items-start justify-center gap-2">
		{#each projectsWithTasks as project (project.projectId)}
			{#if project && project.tasks.length > 0}
				<Collapsible.Root
					defaultOpen
					class="group w-full max-w-[350px] grow rounded-xl border border-gray-200"
				>
					<Collapsible.Trigger
						class="flex h-[50px] w-full min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-t-lg bg-amber-200 bg-linear-to-r from-rose-50 to-indigo-100 px-4 text-slate-800"
					>
						<div class="flex flex-row items-center justify-start gap-2">
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
										class="mb-2 flex items-center justify-between gap-2 text-lg font-medium text-gray-900 lg:text-xl"
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
									class="mt-2 flex flex-1 flex-col overflow-hidden border-t border-gray-200 pt-2"
								>
									<Carousel.Root
										defaultPage={0}
										slideCount={project.tasks.length}
										autoplay={{ delay: 5000 }}
										loop={true}
										allowMouseDrag={true}
									>
										<Carousel.Control>
											<Carousel.Context>
												{#snippet render(api)}
													<div style="background: yellow; padding: 4px; font-size: 12px;">
														Debug: Playing={api.isPlaying ? 'YES' : 'NO'} | isDragging={api.isDragging
															? 'YES'
															: 'NO'} | canScrollNext={api.canScrollNext ? 'YES' : 'NO'}
													</div>
												{/snippet}
											</Carousel.Context>
										</Carousel.Control>
										<Carousel.ItemGroup class="overflow-hidden">
											{#each project.tasks as task, index (task.taskId)}
												<Carousel.Item {index}>
													<div
														class="flex h-full min-h-[100px] w-full flex-col justify-between rounded-2xl border border-neutral-600/20 bg-linear-to-br p-4 duration-200 md:p-5 {getPriorityGradient(
															task.taskPriority
														)}"
													>
														<div class="flex items-center justify-between gap-2">
															<div class="min-w-0 flex-1">
																<p
																	class="text-md min-w-0 flex-1 items-center truncate font-bold text-gray-900 md:text-lg"
																>
																	{task.taskName}
																</p>
															</div>

															<div class="shrink-0">
																{#if task.taskStatus}
																	<span
																		class="lg:text-md inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium whitespace-nowrap {getStatusColor(
																			task.taskStatus
																		)}"
																	>
																		{task.taskStatus}
																	</span>
																{/if}
															</div>
														</div>

														{#if task.taskDescription}
															<p class="lg:text-md mt-2 line-clamp-3 text-sm text-gray-600">
																{task.taskDescription}
															</p>
														{/if}

														<div
															class="text-md mt-3 flex items-center justify-between gap-2 text-gray-800"
														>
															<span>Start: {formatDate(task.taskStartDate)}</span>
															<span>Due: {formatDate(task.taskDueDate)}</span>
														</div>

														<!-- Assigned to (kept) -->
														<div class="mt-3 border-t border-gray-200 pt-2 md:mt-4 md:pt-3">
															{#if task.architectName}
																<p class="text-lg text-gray-700">
																	Assigned to:
																	<span class="font-bold text-gray-900">{task.architectName}</span>
																</p>
															{:else}
																<p class="text-xs text-gray-500 italic md:text-sm">Unassigned</p>
															{/if}
														</div>
													</div>
												</Carousel.Item>
											{/each}
										</Carousel.ItemGroup>
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
