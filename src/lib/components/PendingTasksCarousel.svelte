<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { getPriorityColor, getPriorityGradient, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';

	// same stores / pattern used in your other components
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';

	let loading = $state(true);
	let error: string | null = $state(null);
	const carouselInstances = new SvelteMap();

	// Local copies of store state - added byId for enrichment
	let architectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let projectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let tasksState = $state({ list: [], loading: true, error: null, byId: {} });

	$effect(() => {
		const unsub = architectsStore.subscribe((s) => {
			architectsState = s;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = projectsStore.subscribe((s) => {
			projectsState = s;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = tasksStore.subscribe((s) => {
			tasksState = s;
		});
		return unsub;
	});

	// Derived: today's pending tasks (due today and not Completed/Cancelled)
	let todaysPendingTasks = $derived.by(() => {
		const tasks = tasksState.list || [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		return tasks.filter((task) => {
			if (!task?.taskDueDate) return false;
			const due = new Date(task.taskDueDate);
			if (Number.isNaN(due.getTime())) return false;
			due.setHours(0, 0, 0, 0);

			const notFinished =
				(task.taskStatus ?? '').toLowerCase() !== 'completed' &&
				(task.taskStatus ?? '').toLowerCase() !== 'cancelled';

			return due.getTime() === today.getTime() && notFinished;
		});
	});

	// Slide width scaled up by ~50% from previous defaults.
	// Responsive: smaller on mobile, larger on desktop
	// Mobile: 280px, Tablet: 380px, Desktop: 480px
	const getSlideWidth = () => {
		if (typeof window === 'undefined') return 280;
		if (window.innerWidth < 640) return 280; // mobile (sm breakpoint)
		return 380; // desktop
	};

	let slideWidth = $state(280);
	const SLIDE_MAX_WIDTH_PX = 540;

	function initCarousel(node: HTMLElement, carouselId: string) {
		// initialize only if there are slides
		if (!todaysPendingTasks || todaysPendingTasks.length === 0) return;

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

		carouselInstances.set(carouselId, embla);

		return {
			destroy() {
				try {
					embla.destroy();
				} catch {}
				carouselInstances.delete(carouselId);
			}
		};
	}

	function navigateCarousel(carouselId: string, direction: 'prev' | 'next') {
		const embla: EmblaCarouselType = carouselInstances.get(carouselId) as EmblaCarouselType;
		if (!embla) return;
		if (direction === 'prev') embla.scrollPrev();
		else embla.scrollNext();
	}

	onMount(async () => {
		try {
			loading = true;

			// Set initial slide width
			slideWidth = getSlideWidth();

			// Update slide width on window resize
			const handleResize = () => {
				slideWidth = getSlideWidth();
			};
			window.addEventListener('resize', handleResize);

			await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);

			// CRITICAL: enrich tasks with names
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);

			// Refresh data when window regains focus
			const handleFocus = async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				// CRITICAL: Re-enrich tasks after refresh
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
				// CRITICAL: Re-enrich tasks after refresh
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			}, 30000); // 30 seconds

			// Cleanup
			return () => {
				window.removeEventListener('focus', handleFocus);
				window.removeEventListener('resize', handleResize);
				clearInterval(refreshInterval);
			};
		} catch (err) {
			console.error('Error loading pending tasks:', err);
			if (err instanceof Error) error = err.message;
			else error = 'Unknown error';
		} finally {
			loading = false;
		}
	});
</script>

{#if loading}
	<div class="flex h-80 items-center justify-center">
		<div class="h-20 w-20 animate-spin rounded-full border-b-2 border-blue-600"></div>
	</div>
{:else if error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
		<h2 class="mb-4 font-semibold">Error loading data</h2>
		<p>{error}</p>
	</div>
{:else if todaysPendingTasks.length === 0}
	<div
		class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-2xl font-bold text-yellow-700"
	>
		<p>No pending tasks for today.</p>
	</div>
{:else}
	<!-- outer container takes full width with padding to prevent shadow clipping -->
	<div
		class="group mb-4 inline-block w-full
          break-inside-avoid
          [-webkit-column-break-inside:avoid]
					[page-break-inside:avoid]"
	>
		<div class="relative flex w-full flex-1 flex-col">
			<!-- EMBLA: full-width wrapper (stretches to available width) -->
			<div class="embla w-full overflow-visible" use:initCarousel={'pending-tasks'}>
				<!-- embla__container is a horizontal row; slides are fixed-width tiles -->
				<div class="embla__container flex items-stretch gap-2 px-2 py-2 md:gap-4 md:px-4">
					{#each todaysPendingTasks as task (task.taskId)}
						<!-- slide: responsive fixed width -->
						<div
							class="embla__slide shrink-0"
							style="flex: 0 0 {slideWidth}px; width: {slideWidth}px; max-width: {SLIDE_MAX_WIDTH_PX}px;"
						>
							<!-- Task Card with gradient and shadow -->
							<div
								class="flex h-full min-h-[120px] flex-col rounded-2xl border border-neutral-600/20 bg-linear-to-br md:min-h-[200px] md:rounded-3xl {getPriorityGradient(
									task.taskPriority
								)} p-4 shadow-lg transition-shadow duration-200 hover:shadow-xl md:p-5"
							>
								<!-- Header with priority dot and title -->
								<div class="mb-2 flex items-center gap-2 md:mb-3 md:gap-3">
									<h3 class="truncate text-base font-bold text-gray-900 sm:text-lg md:text-xl">
										{task.taskName}
									</h3>
								</div>

								<!-- Status and Project badges -->
								<div class="mb-2 flex flex-wrap items-center gap-2 md:mb-3">
									{#if task.taskStatus}
										<span
											class="rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap md:px-3 md:py-1 md:text-sm {getStatusColor(
												task.taskStatus
											)}"
										>
											{task.taskStatus}
										</span>
									{/if}
									{#if task.projectName}
										<span
											class="truncate rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 md:px-3 md:py-1 md:text-sm"
										>
											{task.projectName}
										</span>
									{/if}
								</div>

								<!-- Description - flexible space -->
								<div class="flex-1">
									{#if task.taskDescription}
										<p class="line-clamp-3 text-xs text-gray-600 sm:text-sm md:text-base">
											{task.taskDescription}
										</p>
									{/if}
								</div>

								<!-- Assigned to text - pinned to bottom -->
								<div class="mt-3 border-t border-gray-200 pt-2 sm:mt-4 sm:pt-3">
									{#if task.architectName}
										<p class="text-xl text-gray-700">
											Assigned to: <span class="font-bold text-gray-900">{task.architectName}</span>
										</p>
									{:else}
										<p class="text-xs text-gray-500 italic sm:text-sm">Unassigned</p>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Navigation Buttons (controls the single embla instance) -->
			{#if todaysPendingTasks.length > 1}
				<button
					class="bg-opacity-90 hover:bg-opacity-100 absolute top-1/2 left-1 -translate-y-1/2 transform rounded-full
									bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 sm:left-3 sm:p-3"
					onclick={() => navigateCarousel('pending-tasks', 'prev')}
					aria-label="Previous task"
				>
					<svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>

				<button
					class="bg-opacity-90 hover:bg-opacity-100 absolute top-1/2 right-1 -translate-y-1/2 transform rounded-full
									bg-white p-2 text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 sm:right-3 sm:p-3"
					onclick={() => navigateCarousel('pending-tasks', 'next')}
					aria-label="Next task"
				>
					<svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
	/* keep embla container vertically centered */
	.embla__container {
		align-items: stretch;
	}

	/* small scrollbar helpers */
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

	/* clamp helper for description */
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
