<script>
	import { onMount } from 'svelte';
	import EmblaCarousel from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';

	// Sample data
	const architects = [
		{
			id: 1,
			name: 'Architect 1',
			tasks: [
				{
					id: 1,
					name: 'Task Name',
					subtasks: [
						{ id: 1, name: 'Subtask Name' },
						{ id: 2, name: 'Subtask Name' },
						{ id: 3, name: 'Subtask Name' },
						{ id: 4, name: 'Subtask Name' }
					]
				},
				{
					id: 2,
					name: 'Task Name',
					subtasks: [
						{ id: 1, name: 'Subtask Name' },
						{ id: 2, name: 'Subtask Name' }
					]
				},
				{
					id: 3,
					name: 'Task Name',
					subtasks: [
						{ id: 1, name: 'Subtask Name' },
						{ id: 2, name: 'Subtask Name' },
						{ id: 3, name: 'Subtask Name' }
					]
				}
			]
		},
		{
			id: 2,
			name: 'Architect 2',
			tasks: [
				{
					id: 1,
					name: 'Task Name',
					subtasks: [
						{ id: 1, name: 'Subtask Name' },
						{ id: 2, name: 'Subtask Name' }
					]
				},
				{
					id: 2,
					name: 'Task Name',
					subtasks: [
						{ id: 1, name: 'Subtask Name' },
						{ id: 2, name: 'Subtask Name' },
						{ id: 3, name: 'Subtask Name' }
					]
				}
			]
		},
		{
			id: 3,
			name: 'Architect 3',
			tasks: [
				{
					id: 1,
					name: 'Task Name',
					subtasks: [
						{ id: 1, name: 'Subtask Name' },
						{ id: 2, name: 'Subtask Name' },
						{ id: 3, name: 'Subtask Name' },
						{ id: 4, name: 'Subtask Name' },
						{ id: 5, name: 'Subtask Name' }
					]
				}
			]
		}
	];

	let carousels = {};
	let hoveredCarousel = null;

	onMount(() => {
		// Initialize carousels for each architect
		architects.forEach((architect) => {
			const emblaNode = document.querySelector(`[data-carousel="${architect.id}"]`);
			if (emblaNode) {
				const autoplay = Autoplay({
					delay: 3000,
					stopOnMouseEnter: true,
					stopOnInteraction: false
				});

				const embla = EmblaCarousel(
					emblaNode,
					{
						loop: true,
						align: 'center',
						skipSnaps: false,
						dragFree: false
					},
					[autoplay]
				);

				carousels[architect.id] = embla;
			}
		});

		// Cleanup function
		return () => {
			Object.values(carousels).forEach((carousel) => {
				if (carousel) carousel.destroy();
			});
		};
	});

	function goToPrevious(architectId) {
		if (carousels[architectId]) {
			carousels[architectId].scrollPrev();
		}
	}

	function goToNext(architectId) {
		if (carousels[architectId]) {
			carousels[architectId].scrollNext();
		}
	}

	function handleMouseEnter(architectId) {
		hoveredCarousel = architectId;
	}

	function handleMouseLeave() {
		hoveredCarousel = null;
	}
</script>

<div class="p-8 sm:p-4">
	<div
		class="architect-grid mx-auto grid max-w-full grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
	>
		{#each architects as architect}
			<div class="architect-card rounded-xl border border-gray-200 bg-white p-6 shadow sm:p-4">
				<h2 class="architect-name mb-2 text-center text-xl font-semibold text-gray-800">
					{architect.name}
				</h2>

				<div
					class="relative h-[300px] sm:h-[250px]"
					on:mouseenter={() => handleMouseEnter(architect.id)}
					on:mouseleave={handleMouseLeave}
				>
					<div class="h-full overflow-hidden" data-carousel={architect.id}>
						<div class="flex h-full">
							{#each architect.tasks as task}
								<div class="w-full flex-none px-2">
									<div
										class="task-card flex h-full flex-col rounded-lg border border-gray-200 bg-gray-100 p-4"
									>
										<h3 class="task-name mb-2 text-base font-semibold text-gray-600">
											{task.name}
										</h3>
										<div class="subtask-list flex h-full flex-col gap-1 overflow-y-auto p-2">
											{#each task.subtasks as subtask}
												<div
													class="subtask-card flex-shrink-0 rounded-md border border-gray-300 bg-white p-2"
												>
													<span class="text-sm text-gray-600">{subtask.name}</span>
												</div>
											{/each}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					{#if hoveredCarousel === architect.id}
						<button
							class="previous-button absolute top-1/2 -left-3 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow backdrop-blur-sm transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95"
							on:click={() => goToPrevious(architect.id)}
							aria-label="Previous slide"
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								class="text-gray-600 hover:text-gray-800"
							>
								<path d="m15 18-6-6 6-6" />
							</svg>
						</button>
						<button
							class="next-button absolute top-1/2 -right-3 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow backdrop-blur-sm transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95"
							on:click={() => goToNext(architect.id)}
							aria-label="Next slide"
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								class="text-gray-600 hover:text-gray-800"
							>
								<path d="m9 18 6-6-6-6" />
							</svg>
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
