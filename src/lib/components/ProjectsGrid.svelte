<script lang="ts">
	import { onMount } from 'svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { projectsStore, tasksStore } from '$lib/stores';
	import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';
	import type { Project } from '$lib/types';

	let loading = $state(true);
	let error: string | null = $state(null);
	const carouselInstances = new SvelteMap();

	// Subscribe to stores
	let projectsState = $state({ list: [], loading: true, error: null });
	let tasksState = $state({ list: [], loading: true, error: null });

	$effect(() => {
		const unsubProjects = projectsStore.subscribe((state) => {
			projectsState = state;
			console.log('Projects state updated:', state);
		});
		return unsubProjects;
	});

	$effect(() => {
		const unsubTasks = tasksStore.subscribe((state) => {
			tasksState = state;
			console.log('Tasks state updated:', state);
		});
		return unsubTasks;
	});

	// Build projects with their tasks
	let projectsWithTasks = $derived.by(() => {
		const projects = projectsState.list;
		const tasks = tasksState.list;

		console.log('Building projects with tasks:', { projects, tasks });

		// Group tasks by project
		const tasksByProject = new Map<string, typeof tasks>();
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

		console.log('Projects with tasks:', result);
		return result;
	});

	onMount(async () => {
		try {
			loading = true;
			console.log('Loading projects and tasks...');

			await Promise.all([projectsStore.load(), tasksStore.load()]);

			console.log('Projects and tasks loaded successfully');
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

	function initCarousel(node: HTMLElement, projectId: string) {
		// Only initialize carousel if there are tasks
		const project = projectsWithTasks.find((p) => p.projectId === projectId);
		if (!project || project.tasks.length === 0) return;

		const embla = EmblaCarousel(
			node,
			{
				loop: true,
				align: 'start',
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

		carouselInstances.set(projectId, embla);

		return {
			destroy() {
				embla.destroy();
				carouselInstances.delete(projectId);
			}
		};
	}

	function navigateCarousel(projectId: string, direction: 'prev' | 'next') {
		const embla: EmblaCarouselType = carouselInstances.get(projectId) as EmblaCarouselType;
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
{:else if projectsWithTasks.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No projects found.</p>
	</div>
{:else}
	<div class="columns gap-4 [column-width:350px]">
		{#each projectsWithTasks as project (project.projectId)}
			{#if project}
				<Accordion
					class="group mb-4 inline-block w-full
          [break-inside:avoid]
          [-webkit-column-break-inside:avoid]
          [page-break-inside:avoid]"
				>
					<AccordionItem
						open
						inactiveClass="flex h-[50px] rounded-xl flex-row items-center justify-between rounded-t-lg bg-gradient-to-r from-rose-50 to-indigo-100 p-2 text-slate-800"
						activeClass="flex flex-row h-[50px] items-center justify-between rounded-t-lg bg-gradient-to-r from-rose-50 to-indigo-100 text-slate-800"
						contentClass="p-2"
					>
						{#snippet arrowup()}{/snippet}
						{#snippet arrowdown()}{/snippet}
						{#snippet header()}
							<div class="flex min-w-0 flex-1 items-center gap-2">
								<div
									class="min-h-4 min-w-4 flex-shrink-0 rounded-full {getPriorityColor(
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
						{/snippet}

						<!-- Project Content -->
						<div class="flex flex-col gap-4 p-2">
							<!-- Project Details -->
							<div class="flex-shrink-0">
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

							<!-- Tasks Section -->
							{#if project.tasks.length > 0}
								<div class="flex flex-col overflow-hidden border-t pt-4">
									<h4 class="mb-3 flex-shrink-0 text-lg font-medium text-gray-900 lg:text-xl">
										Tasks ({project.tasks.length})
									</h4>
									<div class="max-h-[400px] space-y-2 overflow-y-auto pr-2">
										{#each project.tasks as task (task.taskId)}
											<div class="flex-shrink-0 rounded-lg bg-gray-50 p-3">
												<div class="flex items-start justify-between gap-2">
													<div class="min-w-0 flex-1">
														<p class="text-md font-medium text-gray-900 lg:text-lg">
															{task.taskName}
														</p>
														{#if task.taskDescription}
															<p class="lg:text-md mt-1 text-sm text-gray-600">
																{task.taskDescription}
															</p>
														{/if}
														{#if task.architectName}
															<p class="mt-1 text-sm text-gray-500">
																Assigned to: <span class="font-medium">{task.architectName}</span>
															</p>
														{/if}
														<div class="mt-2 flex items-center gap-2 text-sm text-gray-600">
															{#if task.taskStartDate}
																<span>Start: {formatDate(task.taskStartDate)}</span>
															{/if}
															{#if task.taskDueDate}
																<span>• Due: {formatDate(task.taskDueDate)}</span>
															{/if}
														</div>
													</div>
													<div class="flex flex-col items-end gap-2">
														{#if task.taskStatus}
															<span
																class="lg:text-md inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium whitespace-nowrap {getStatusColor(
																	task.taskStatus
																)}"
															>
																{task.taskStatus}
															</span>
														{/if}
														{#if task.taskPriority}
															<div
																class="min-h-3 min-w-3 flex-shrink-0 rounded-full {getPriorityColor(
																	task.taskPriority
																)}"
																aria-hidden="true"
															></div>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<div class="flex flex-1 items-center justify-center p-6">
									<p class="text-center text-gray-500">No tasks assigned to this project</p>
								</div>
							{/if}
						</div>
					</AccordionItem>
				</Accordion>
			{/if}
		{/each}
	</div>
{/if}

<style>
	/* Custom scrollbar */
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
</style>
