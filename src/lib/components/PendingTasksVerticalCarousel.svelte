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

	// Reactive state for slides per page based on screen size
	let slidesPerPage = $state(1);

	// helpers (place near top of <script>)
	function computeSlidesPerPage(): number {
		const height = window.innerHeight || 800;
		return Math.max(1, Math.min(4, Math.floor(height / 260)));
	}

	/** tiny debounce utility */
	function debounce<T extends (...args: any[]) => void>(fn: T, wait = 120) {
		let t: number | undefined;
		return (...args: Parameters<T>) => {
			if (t) window.clearTimeout(t);
			t = window.setTimeout(() => fn(...args), wait);
		};
	}
	onMount(async () => {
		let refreshInterval: number | undefined;
		let handleFocus: () => Promise<void>;
		try {
			loading = true;

			// set initial slides but ensure it's integer and stable
			slidesPerPage = computeSlidesPerPage();

			// debounce + only apply when value actually changes
			const applyResize = () => {
				const pages = computeSlidesPerPage();
				if (pages !== slidesPerPage) slidesPerPage = pages;
			};
			const onResize = debounce(() => {
				// optionally pause autoplay while resizing (we'll call api.pause in markup via pointer events)
				applyResize();
			}, 120);

			window.addEventListener('resize', onResize);

			await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);

			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);

			// Refresh data when window regains focus — do not replace array identity if not needed
			handleFocus = async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				// re-enrich in-place (your store implementation should patch items rather than replace list)
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			};
			window.addEventListener('focus', handleFocus);

			// keep refresh but don't slam render — interval optional
			refreshInterval = window.setInterval(async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			}, 30000);

			return () => {
				window.removeEventListener('resize', onResize);
				window.removeEventListener('focus', handleFocus);
				if (refreshInterval) window.clearInterval(refreshInterval);
			};
		} catch (err) {
			console.error(err);
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
	<!-- <div -->
	<!-- 	class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-2xl font-bold text-yellow-700" -->
	<!-- > -->
	<!-- 	<p>No pending tasks for today.</p> -->
	<!-- </div> -->
{:else}
	<Carousel.Root
		orientation="vertical"
		defaultPage={0}
		slideCount={todaysPendingTasks.length}
		autoplay={{ delay: 5000 }}
		loop
		allowMouseDrag
		spacing="4px"
		{slidesPerPage}
		class="group/carousel relative max-w-[95%]"
	>
		<Carousel.Context>
			{#snippet render(api)}
				<Carousel.ItemGroup onpointerover={() => api().pause()} onpointerleave={() => api().play()}>
					{#each todaysPendingTasks as task, index (task.taskId)}
						<!-- slide: responsive fixed width; ensure it fills height -->
						<Carousel.Item {index}>
							<div
								class="flex flex-col overflow-hidden rounded-2xl border border-neutral-600/20 bg-linear-to-br px-2 py-1 duration-200 md:rounded-3xl md:px-3 md:py-2 {getPriorityGradient(
									task.taskPriority
								)}"
							>
								<!-- Header with priority dot and title -->
								<div class="flex items-center gap-2 md:gap-3">
									<h3 class="truncate text-base font-bold text-gray-900 sm:text-lg md:text-xl">
										{task.taskName}
									</h3>
								</div>

								<!-- Status and Project badges -->
								<div class="mt-2 flex flex-col flex-wrap items-start gap-2">
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

								<!-- Assigned to text - pinned to bottom; removed <br /> and used truncation -->
								<div class="mt-2 border-t border-gray-200 pt-2">
									{#if task.architectName}
										<p class="text-lg text-gray-700">
											<span class="text-md text-gray-500">Assigned to:</span>
											<span
												class="block truncate font-bold text-gray-900"
												title={task.architectName}
											>
												{task.architectName}
											</span>
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

	/* two-line truncation helper for titles */
	.truncate-2-lines {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* small responsive min-heights so footer is stable */
	@media (min-width: 640px) {
		/* gives more breathing room on sm+ */
		.carousel-card-body {
			min-height: 3.5rem;
		}
	}
</style>
