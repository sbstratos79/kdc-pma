<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteDate, SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { taskData } from '$lib/stores/ptsDataStore';

	let loading = $state(true);
	let error: string | null = $state(null);
	const carouselInstances = new SvelteMap();

	onMount(async () => {
		try {
			return $taskData;
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			}
		} finally {
			loading = false;
		}
	});

	function initCarousel(node: HTMLElement, taskId: string) {
		const embla = EmblaCarousel(
			node,
			{
				loop: true,
				align: 'start',
				skipSnaps: true,
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

		carouselInstances.set(taskId, embla);

		return {
			destroy() {
				embla.destroy();
				carouselInstances.delete(taskId);
			}
		};
	}

	/**
	 * Navigate carousel
	 * @param {string} taskId
	 * @param {'prev' | 'next'} direction
	 */
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

	let todaysPendingTasks = $derived(
		$taskData.filter((task) => {
			if (!task.taskDueDate) {
				return false;
			}

			// Get the current date and reset the time to midnight for a clean date-only comparison.
			const today = new SvelteDate();
			today.setHours(0, 0, 0, 0);

			// Parse the task's due date and also reset its time to midnight.
			const dueDate = new SvelteDate(task.taskDueDate);
			dueDate.setHours(0, 0, 0, 0);

			// Return true only if the dates match.
			return (
				(today.getTime() === dueDate.getTime() &&
					task.taskStatus !== 'Completed' &&
					task.taskStatus !== 'Cancelled') ||
				false
			);
		})
	);
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
{:else if $taskData.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No tasks found.</p>
	</div>
{:else}
	<div
		class="group mb-2 inline-block w-[98%]
          break-inside-avoid
          [-webkit-column-break-inside:avoid]
          [page-break-inside:avoid]"
	>
		<div class="relative flex flex-1 flex-col">
			{#each todaysPendingTasks as task (task.taskId)}
				<!-- Carousel Container -->
				<div class="embla h-full w-full overflow-hidden" use:initCarousel={task.taskId}>
					<div class="embla__container flex px-10">
						{#if task}
							<div
								class="embla__slide
										max-h-[260px]
              			max-w-[400px]
              			min-w-0
              			flex-[0_0_100%]
              			overflow-hidden
              			p-2"
							>
								<!-- Task Card -->
								<div
									class="flex h-full flex-col rounded-2xl border border-neutral-600/20 p-4 shadow-md shadow-slate-900/20"
								>
									<!-- Task Header -->
									<div class="mb-2 flex-shrink-0">
										{#if task.taskName}
											<div class="justify-left mb-2 ml-2 flex flex-row items-center gap-2">
												<div
													class="min-h-4 min-w-4 rounded-full {getPriorityColor(task.taskPriority)}"
												></div>
												<h3 class="truncate text-xl font-semibold text-gray-900 lg:text-2xl">
													{task.taskName}
												</h3>
											</div>
										{/if}
									</div>
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
										{#if task.architectName}
											<span
												class="min-w-0 flex-shrink overflow-hidden
          										rounded-full border border-rose-200 bg-rose-100 px-2.5
          										py-0.5 text-sm font-bold whitespace-nowrap text-rose-800 lg:text-lg
        											"
											>
												{task.architectName}
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
									{#if task.taskDescription}
										<p class="text-md mt-2 truncate text-gray-600 lg:text-xl">
											{task.taskDescription}
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
			<!-- Navigation Buttons -->
			{#if $taskData.length > 1}
				<button
					class="bg-opacity-80 hover:bg-opacity-100 absolute top-1/2 left-2 -translate-y-1/2 transform
									rounded-full bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100"
					onclick={() => navigateCarousel(todaysPendingTasks.taskData.taskId, 'prev')}
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
					onclick={() => navigateCarousel(todaysPendingTasks.taskId, 'next')}
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
		background: #94a3b8;
	}
</style>
