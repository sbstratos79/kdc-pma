<script lang="ts">
	import { onMount } from 'svelte';
	import { Carousel } from '@ark-ui/svelte/carousel';
	import { getPriorityGradient, getStatusColor } from '$lib/utils/colorUtils';

	// same stores / pattern used in your other components
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { SvelteDate } from 'svelte/reactivity';

	let loading = $state(true);
	let error: string | null = $state(null);

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
		const today = new SvelteDate();
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

	// Reactive state for slides per page based on screen size
	let slidesPerPage = $state(1);

	onMount(async () => {
		try {
			loading = true;

			const updateSlidesPerPage = () => {
				const width = window.innerWidth;
				slidesPerPage = width / 360;
			};

			// Set initial value
			updateSlidesPerPage();

			// Update on resize
			window.addEventListener('resize', updateSlidesPerPage);

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
				window.removeEventListener('resize', updateSlidesPerPage);
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
	<Carousel.Root
		defaultPage={0}
		slideCount={todaysPendingTasks.length}
		autoplay={{ delay: 5000 }}
		loop
		allowMouseDrag
		spacing="4px"
		class="group/carousel relative"
		padding="40px"
		{slidesPerPage}
	>
		<Carousel.Context>
			{#snippet render(api)}
				<Carousel.ItemGroup onpointerover={() => api().pause()} onpointerleave={() => api().play()}>
					{#each todaysPendingTasks as task, index (task.taskId)}
						<!-- slide: responsive fixed width -->
						<Carousel.Item {index} class="max-h-50 max-w-90 py-2">
							<div
								class="flex h-full flex-col rounded-2xl border border-neutral-600/20 bg-linear-to-br md:rounded-3xl {getPriorityGradient(
									task.taskPriority
								)} px-2 py-1 duration-200 md:px-3 md:py-2"
							>
								<!-- Header with priority dot and title -->
								<div class="flex items-center gap-2 md:gap-3">
									<h3 class="truncate text-base font-bold text-gray-900 sm:text-lg md:text-xl">
										{task.taskName}
									</h3>
								</div>

								<!-- Status and Project badges -->
								<div class="flex flex-wrap items-center gap-2">
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
								<div class="my-2 flex-1">
									{#if task.taskDescription}
										<p class="line-clamp-3 text-xs text-gray-600 sm:text-sm md:text-base">
											{task.taskDescription}
										</p>
									{/if}
								</div>

								<!-- Assigned to text - pinned to bottom -->
								<div class="border-t border-gray-200 pt-2">
									{#if task.architectName}
										<p class="text-xl text-gray-700">
											Assigned to: <span class="font-bold text-gray-900">{task.architectName}</span>
										</p>
									{:else}
										<p class="text-xs text-gray-500 italic sm:text-sm">Unassigned</p>
									{/if}
								</div>
							</div>
						</Carousel.Item>
					{/each}
				</Carousel.ItemGroup>
			{/snippet}
		</Carousel.Context>
		<!-- Navigation Controls - Show on Hover -->
		<Carousel.Control class="pointer-events-none absolute inset-0">
			<Carousel.PrevTrigger
				class="pointer-events-auto absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-opacity duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-gray-800"
				>
					<path d="m15 18-6-6 6-6" />
				</svg>
			</Carousel.PrevTrigger>

			<Carousel.NextTrigger
				class="pointer-events-auto absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-2 opacity-0 shadow-lg transition-opacity duration-200 group-hover/carousel:opacity-100 hover:scale-110 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-gray-800"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</Carousel.NextTrigger>
		</Carousel.Control>
	</Carousel.Root>
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
