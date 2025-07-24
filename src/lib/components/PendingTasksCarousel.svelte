<script lang="ts">
	// import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';

	let loading = $state(true);
	let error = $state(null);
	let { taskData } = $props();
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

	function initCarousel(node, taskId) {
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

<div class="columns gap-4 [column-width:350px]">
	<div
		class="group mb-4 inline-block w-full
          [break-inside:avoid]
          [-webkit-column-break-inside:avoid]
          [page-break-inside:avoid]"
	>
		<div class="relative flex flex-1 flex-col">
			<!-- Carousel Container -->
			<div class="embla h-full overflow-hidden" use:initCarousel={taskData.taskId}>
				<div class="embla__container flex w-screen">
					{#each taskData as task (task.taskId)}
						{#if task}
							<div
								class="embla__slide
              			max-h-[560px]
              			min-w-0
              			flex-[0_0_100%]
              			overflow-hidden
              			p-2"
							>
								<!-- Task Card -->
								<div class="flex h-full flex-col border-amber-900">
									<!-- Task Header -->
									<div class="mb-4 flex-shrink-0">
										{#if task.taskName}
											<div class="justify-left mb-3 ml-2 flex flex-row items-center gap-2">
												<div
													class="min-h-4 min-w-4 rounded-full {getPriorityColor(task.taskPriority)}"
												></div>
												<h3 class="truncate text-xl font-semibold text-gray-900 lg:text-2xl">
													{task.taskName}
												</h3>
											</div>
										{/if}
									</div>
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
						{/if}
					{/each}
				</div>
			</div>

			<!-- Navigation Buttons -->
			{#if taskData.length > 1}
				<button
					class="bg-opacity-80 hover:bg-opacity-100 absolute top-1/2 left-2 -translate-y-1/2 transform
									rounded-full bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100"
					onclick={() => navigateCarousel(taskData.taskId, 'prev')}
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
					onclick={() => navigateCarousel(taskData.taskId, 'next')}
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
</div>
