<script lang="ts">
	// import { onMount } from 'svelte';
	import { Progressbar, AccordionItem, Accordion } from 'flowbite-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	// import type { Architect } from '$lib/types';

	let loading = $state(true);
	let error = $state(null);
	let { projectDataValues } = $props();
	const carouselInstances = new SvelteMap();

	// onMount(async () => {
	// 	try {
	// 		return await architectDataValues;
	// 	} catch (err) {
	// 		error = err.message;
	// 	} finally {
	// 		loading = false;
	// 	}
	// });

	function initCarousel(node, projectId) {
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
					delay: 4000,
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

	/**
	 * Navigate carousel
	 * @param {string} projectId
	 * @param {'prev' | 'next'} direction
	 */
	function navigateCarousel(taskId, direction) {
		const embla = carouselInstances.get(taskId);
		if (embla) {
			if (direction === 'prev') {
				embla.scrollPrev();
			} else {
				embla.scrollNext();
			}
		}
	}

	/**
	 * Get status color classes
	 * @param {string} status
	 * @returns {string}
	 */
	function getStatusColor(status) {
		const statusLower = status ? status : '';
		switch (statusLower) {
			case 'Completed':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'In Progress':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'Planning':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'On Hold':
				return 'bg-slate-100 text-slate-800 border-slate-200';
			case 'Cancelled':
				return 'bg-red-100 text-red-800 border-red-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	}

	/**
	 * Get priority color classes
	 * @param {string} priority
	 * @returns {string}
	 */
	function getPriorityColor(priority) {
		const priorityLower = priority;
		switch (priorityLower) {
			case 'High':
				return 'bg-red-500';
			case 'Medium':
				return 'bg-yellow-500';
			case 'Low':
				return 'bg-green-500';
			default:
				return 'bg-gray-500';
		}
	}

	/**
	 * Format date string
	 * @param {string | null} dateString
	 * @returns {string}
	 */
	function formatDate(dateString) {
		if (!dateString) return 'Not set';
		try {
			return new Date(dateString).toLocaleDateString('IN');
		} catch {
			return 'Invalid date';
		}
	}
</script>

<!-- {#if loading} -->
<!-- 	<div class="flex h-64 items-center justify-center"> -->
<!-- 		<div class="h-16 w-16 animate-spin rounded-full border-b-2 border-blue-600"></div> -->
<!-- 	</div> -->
<!-- {:else if error} -->
<!-- 	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"> -->
<!-- 		<h2 class="mb-2 font-semibold">Error loading data</h2> -->
<!-- 		<p>{error}</p> -->
<!-- 	</div> -->
<!-- {:else if architectDataValues.length === 0} -->
<!-- 	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700"> -->
<!-- 		<p>No architects found.</p> -->
<!-- 	</div> -->
<!-- {:else} -->
<div class="columns gap-4 [column-width:350px]">
	{#each projectDataValues as project (project.projectId)}
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
															<h3 class="truncate text-xl font-semibold text-gray-900 lg:text-2xl">
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
