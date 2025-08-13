<script lang="ts">
	import { onMount } from 'svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';
	import { architectProjectData } from '$lib/stores/ptsDataStore';

	let loading = $state(true);
	let error: string | null = $state(null);
	const carouselInstances = new SvelteMap();
	const selectedIndices = new SvelteMap();

	onMount(async () => {
		try {
			return $architectProjectData;
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
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

		carouselInstances.set(architectId, embla);
		selectedIndices.set(architectId, embla.selectedScrollSnap());

		embla.on('select', () => {
			const newIndex = embla.selectedScrollSnap();
			selectedIndices.set(architectId, newIndex);
			scrollToActiveProject(architectId, newIndex);
		});

		return {
			destroy() {
				embla.destroy();
				carouselInstances.delete(architectId);
				selectedIndices.delete(architectId);
			}
		};
	}

	function navigateCarousel(architectId: string, direction: 'prev' | 'next') {
		const embla: EmblaCarouselType = carouselInstances.get(architectId);
		if (embla) {
			if (direction === 'prev') embla.scrollPrev();
			else embla.scrollNext();
		}
	}

	function goToProject(architectId: string, projectIndex: number) {
		const embla: EmblaCarouselType = carouselInstances.get(architectId);
		if (embla) embla.scrollTo(projectIndex);
	}

	function isProjectActive(architectId: string, projectIndex: number) {
		return selectedIndices.get(architectId) === projectIndex;
	}

	/**
	 * Scroll project list to keep active project fully visible
	 */
	function scrollToActiveProject(architectId: string, activeIndex: number) {
		setTimeout(() => {
			const projectList = document.querySelector(
				`[data-architect-id="${architectId}"] .project-list`
			);
			const activeProject = document.querySelector(
				`[data-architect-id="${architectId}"] .project-item[data-project-index="${activeIndex}"]`
			);

			if (projectList && activeProject) {
				if (activeIndex === 0) {
					projectList.scrollTop = 0;
					return;
				}

				// Ensure the active item is fully visible within its container
				activeProject.scrollIntoView({
					behavior: 'auto',
					block: 'nearest'
				});
			}
		}, 50);
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
{:else if $architectProjectData.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No architects found.</p>
	</div>
{:else}
	<div class="columns gap-4 [column-width:350px]">
		{#each $architectProjectData as architect (architect.architectId)}
			{#if architect}
				<Accordion
					class="group mb-4 inline-block w-full
          [break-inside:avoid]
          [-webkit-column-break-inside:avoid]
          [page-break-inside:avoid]"
					data-architect-id={architect.architectId}
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
							<h2 class="truncate text-2xl font-black">
								{architect.firstName || 'Unassigned projects'}
								{architect.lastName || ''}
							</h2>
							<p class="text-center text-2xl font-bold text-nowrap text-slate-800">
								{architect.projects.length} project{architect.projects.length !== 1 ? 's' : ''}
							</p>
						{/snippet}

						<div
							class="project-list scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 flex max-h-48 flex-col overflow-y-auto"
						>
							{#if architect.projects.length > 0}
								{#each architect.projects as project, projectIndex (project.projectId)}
									<button
										class="project-item my-1 flex flex-shrink-0 cursor-pointer flex-row items-center justify-between rounded-lg p-1 transition-all duration-200 {isProjectActive(
											architect.architectId,
											projectIndex
										)
											? 'border-2 border-blue-300 bg-blue-100 shadow-md'
											: 'bg-gray-50 hover:bg-gray-100'}"
										data-project-index={projectIndex}
										onclick={() => goToProject(architect.architectId, projectIndex)}
									>
										{#if project.projectName}
											<div
												class="justify-left flex max-w-[85%] flex-row items-center gap-2 truncate"
											>
												<div
													class="min-h-4 min-w-4 rounded-full {getPriorityColor(
														project.projectPriority
													)}"
												></div>
												<h3
													class="text-md truncate font-semibold lg:text-lg {isProjectActive(
														architect.architectId,
														projectIndex
													)
														? 'text-blue-900'
														: 'text-gray-900'}"
												>
													{project.projectName}
												</h3>
											</div>
										{/if}
										{#if project.projectStatus}
											<span
												class="lg:text-md shrink-1 rounded-full border px-2.5 py-0.5 text-sm font-bold whitespace-nowrap {getStatusColor(
													project.projectStatus
												)}"
											>
												{project.projectStatus}
											</span>
										{/if}
									</button>
								{/each}
							{/if}
						</div>

						<!-- Project Carousel -->
						{#if architect.projects.length > 0}
							<div class="relative flex flex-1 flex-col">
								<!-- Carousel Container -->
								<div
									class="embla max-h-[760px] overflow-hidden"
									use:initCarousel={architect.architectId}
								>
									<div class="embla__container flex max-h-[760px]">
										{#each architect.projects as project (project.projectId)}
											<div
												class="embla__slide
              									max-h-[760px]
              									min-w-0
              									flex-[0_0_100%]
              									overflow-hidden
              									p-2"
											>
												<!-- Project Card -->
												<div class="flex h-full flex-col">
													<!-- Task Header -->
													<div class="mb-4 flex-shrink-0">
														<div
															class="mb-3 flex items-center justify-between gap-2 text-lg font-medium text-gray-900 lg:text-xl"
														>
															<span>Start: {formatDate(project.projectStartDate)}</span>
															<span>Due: {formatDate(project.projectDueDate)}</span>
														</div>

														{#if project.projectDescription}
															<p class="text-md mb-2 truncate text-gray-600 lg:text-xl">
																{project.projectDescription}
															</p>
														{/if}
													</div>
													<!-- Tasks -->
													{#if project.tasks.length > 0}
														<div class="flex flex-1 flex-col overflow-hidden border-t pt-4">
															<h4
																class="mb-3 flex-shrink-0 text-lg font-medium text-gray-900 lg:text-xl"
															>
																Tasks ({project.tasks.length})
															</h4>
															<div
																class="space-y-2 overflow-y-auto pr-2"
																style="height: calc(100% - 1rem);"
															>
																{#each project.tasks as task (task.taskId)}
																	<div class="flex-shrink-0 rounded-lg bg-gray-50 p-3">
																		<div class="flex items-center justify-between">
																			<div class="min-w-0 flex-1">
																				<p
																					class="text-md truncate font-medium text-gray-900 lg:text-lg"
																				>
																					{task.taskName}
																				</p>
																				{#if task.taskDescription}
																					<p class="lg:text-md mt-1 truncate text-sm text-gray-600">
																						{task.taskDescription}
																					</p>
																				{/if}
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
								<p class="text-center text-gray-500">No tasks assigned</p>
							</div>
						{/if}
					</AccordionItem></Accordion
				>
			{/if}
		{/each}
	</div>
{/if}

<!-- {/if} -->

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

	/* Scrollbar styling for project list */
	.project-list::-webkit-scrollbar {
		width: 6px;
	}

	.project-list::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 3px;
	}

	.project-list::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 3px;
	}

	.project-list::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>
