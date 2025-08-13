<script lang="ts">
	import { onMount } from 'svelte';
	import { Progressbar, AccordionItem, Accordion } from 'flowbite-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';
	import { projectData } from '$lib/stores/ptsDataStore';

	let loading = $state(true);
	let error: string | null = $state(null);
	const carouselInstances = new SvelteMap();

	onMount(async () => {
		try {
			return $projectData;
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			}
		} finally {
			loading = false;
		}
	});

	function initCarousel(node: HTMLElement, projectId: string) {
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

	function navigateCarousel(taskId: string, direction: 'prev' | 'next') {
		const embla: EmblaCarouselType = carouselInstances.get(taskId) as EmblaCarouselType;
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
{:else if $projectData.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No projects found.</p>
	</div>
{:else}
	<div class="columns gap-4 [column-width:350px]">
		{#each $projectData as project (project.projectId)}
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
							<h2 class="truncate text-2xl font-black">
								{project.projectName || 'Unassigned tasks'}
							</h2>
							<p class="text-center text-2xl font-bold text-nowrap text-slate-800">
								{project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}
							</p>
						{/snippet}
						<!-- Task Carousel -->
						{#if project.tasks.length > 0}
							<div class="relative flex flex-1 flex-col">
								<!-- Carousel Container -->
								<div class="embla h-full overflow-hidden" use:initCarousel={project.projectId}>
									<div class="embla__container flex">
										{#each project.tasks as task (task.taskId)}
											<div
												class="embla__slide
              										max-h-[560px]
              										min-w-0
              										flex-[0_0_100%]
              										overflow-hidden
              										p-2"
											>
												<!-- Task Card -->
												<div class="flex h-full flex-col">
													<!-- Task Header -->
													<div class="mb-4 flex-shrink-0">
														{#if task.taskName}
															<div class="justify-left mb-3 ml-2 flex flex-row items-center gap-2">
																<div
																	class="min-h-4 min-w-4 rounded-full {getPriorityColor(
																		task.taskPriority
																	)}"
																></div>
																<h3
																	class="truncate text-xl font-semibold text-gray-900 lg:text-2xl"
																>
																	{task.taskName}
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
																{#if task.taskStatus}
																	<span
																		class="shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-bold whitespace-nowrap lg:text-lg {getStatusColor(
																			task.taskStatus
																		)}"
																	>
																		{task.taskStatus}
																	</span>
																{/if}

																{#if task.architectFirstName}
																	<span
																		class="min-w-0 flex-shrink truncate overflow-hidden
          														rounded-full border border-rose-200 bg-rose-100 px-2.5
          														py-0.5 text-sm font-bold whitespace-nowrap text-rose-800 lg:text-lg
        														"
																	>
																		{task.architectFirstName}
																	</span>
																{/if}
															</div>

															<div
																class="mb-3 flex items-center justify-between gap-2 text-lg font-medium text-gray-900 lg:text-xl"
															>
																<span>Start: {formatDate(task.taskStartDate)}</span>
																<span>Due: {formatDate(task.taskDueDate)}</span>
															</div>
														</div>

														{#if task.taskDescription}
															<p class="text-md truncate text-gray-600 lg:text-xl">
																{task.taskDescription}
															</p>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>

								<!-- Navigation Buttons -->
								{#if project.tasks.length > 1}
									<button
										class="bg-opacity-80 hover:bg-opacity-100 absolute top-1/2 left-2 -translate-y-1/2 transform
										rounded-full bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100"
										onclick={() => navigateCarousel(project.projectId, 'prev')}
										aria-label="Previous task"
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
										onclick={() => navigateCarousel(project.projectId, 'next')}
										aria-label="Next task"
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

						{#if project.tasks.length != 0}
							<Progressbar
								progress={Math.round(
									(project.tasks
										.filter((task) => task.taskStatus !== 'Cancelled')
										.filter((task) => task.taskStatus === 'Completed').length /
										project.tasks.filter((task) => task.taskStatus !== 'Cancelled').length) *
										100
								)}
								size="h-1.5"
								classes={{ labelInsideDiv: 'bg-gradient-to-r from-emerald-400 to-emerald-500' }}
							/>
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
		background: #94a3b8;
	}
</style>
