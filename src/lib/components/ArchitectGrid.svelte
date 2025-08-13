<script lang="ts">
	import { onMount } from 'svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { architectData } from '$lib/stores/ptsDataStore';
	import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';
	import type { EmblaCarouselType } from 'embla-carousel';
	// import type { Architect } from '$lib/types';

	let loading = $state(true);
	let error: string | null = $state(null);
	const carouselInstances = new SvelteMap();

	onMount(async () => {
		try {
			return $architectData;
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

		return {
			destroy() {
				embla.destroy();
				carouselInstances.delete(architectId);
			}
		};
	}

	/**
	 * Navigate carousel
	 * @param {string} architectId
	 * @param {'prev' | 'next'} direction
	 */
	function navigateCarousel(architectId: string, direction: 'prev' | 'next') {
		const embla: EmblaCarouselType = carouselInstances.get(architectId);
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
{:else if $architectData.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No architects found.</p>
	</div>
{:else}
	<div class="columns gap-4 [column-width:350px]">
		{#each $architectData as architect (architect.architectId)}
			{#if architect}
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
								{architect.firstName || 'Unassigned tasks'}
								{architect.lastName || ''}
							</h2>
							<p class="text-center text-2xl font-bold text-nowrap text-slate-800">
								{architect.tasks.length} task{architect.tasks.length !== 1 ? 's' : ''}
							</p>
						{/snippet}

						<!-- Task Carousel -->
						{#if architect.tasks.length > 0}
							<div class="relative flex flex-1 flex-col">
								<!-- Carousel Container -->
								<div
									class="embla max-h-[540px] overflow-hidden"
									use:initCarousel={architect.architectId}
								>
									<div class="embla__container flex max-h-[560px]">
										{#each architect.tasks as task (task.taskId)}
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
															<div
																class="justify-left mb-3 ml-2 flex w-full flex-row items-center gap-2"
															>
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

																{#if task.projectName}
																	<span
																		class="min-w-0 flex-shrink truncate overflow-hidden
          													rounded-full border border-purple-200 bg-purple-100 px-2.5
          													py-0.5 text-sm font-bold whitespace-nowrap text-purple-800 lg:text-lg
        													"
																	>
																		{task.projectName}
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
															<p class="text-md mb-2 truncate text-gray-600 lg:text-xl">
																{task.taskDescription}
															</p>
														{/if}
													</div>
													<!-- Subtasks -->
													{#if task.subtasks.length > 0}
														<div class="flex flex-1 flex-col overflow-hidden border-t pt-4">
															<h4
																class="mb-3 flex-shrink-0 text-lg font-medium text-gray-900 lg:text-xl"
															>
																Subtasks ({task.subtasks.length})
															</h4>
															<div
																class="space-y-2 overflow-y-auto pr-2"
																style="height: calc(100% - 1rem);"
															>
																{#each task.subtasks as subtask (subtask.subtaskId)}
																	<div class="flex-shrink-0 rounded-lg bg-gray-50 p-3">
																		<div class="flex items-center justify-between">
																			<div class="min-w-0 flex-1">
																				<p
																					class="text-md truncate font-medium text-gray-900 lg:text-lg"
																				>
																					{subtask.subtaskName}
																				</p>
																				{#if subtask.subtaskDescription}
																					<p class="lg:text-md mt-1 truncate text-sm text-gray-600">
																						{subtask.subtaskDescription}
																					</p>
																				{/if}
																			</div>
																			{#if subtask.subtaskStatus}
																				<span
																					class="lg:text-md ml-2 inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium {getStatusColor(
																						subtask.subtaskStatus
																					)}"
																				>
																					{subtask.subtaskStatus}
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
								{#if architect.tasks.length > 1}
									<button
										class="bg-opacity-80 hover:bg-opacity-100 absolute top-1/2 left-2 -translate-y-1/2 transform
									rounded-full bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100"
										onclick={() => navigateCarousel(architect.architectId, 'prev')}
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
										onclick={() => navigateCarousel(architect.architectId, 'next')}
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
</style>
