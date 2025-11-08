<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import { taskData } from '$lib/stores/ptsDataStore';
	import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';

	let loading = $state(true);
	let error: string | null = $state(null);

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
	<div class="space-y-4" style="column-width: 400px; column-gap: 1rem;">
		{#each todaysPendingTasks as task (task.taskId)}
			{#if task}
				<div
					class="relative flex w-full break-inside-avoid flex-col rounded-2xl border border-neutral-600/20 p-4 shadow-md shadow-slate-900/20"
				>
					<div class="mb-2 flex-shrink-0">
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

					<div class="mb-3 flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-hidden">
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
								class="min-w-0 flex-shrink truncate overflow-hidden rounded-full border border-rose-200 bg-rose-100 px-2.5 py-0.5 text-sm font-bold whitespace-nowrap text-rose-800 lg:text-lg"
							>
								{task.architectName}
							</span>
						{/if}
						{#if task.projectName}
							<span
								class="min-w-0 flex-shrink truncate overflow-hidden rounded-full border border-purple-200 bg-purple-100 px-2.5 py-0.5 text-sm font-bold whitespace-nowrap text-purple-800 lg:text-lg"
							>
								{task.projectName}
							</span>
						{/if}
					</div>

					{#if task.taskDescription}
						<p class="text-md mb-3 truncate text-gray-600 lg:text-xl">
							{task.taskDescription}
						</p>
					{/if}

					{#if task.subtasks && task.subtasks.filter((subtask) => subtask.subtaskStatus != 'Completed' && subtask.subtaskStatus != 'Cancelled').length > 0}
						<div class="flex flex-col border-t pt-4">
							<h4 class="mb-3 flex-shrink-0 text-lg font-medium text-gray-900 lg:text-xl">
								Subtasks ({task.subtasks.length})
							</h4>
							<div class="max-h-64 space-y-2 overflow-y-auto pr-2">
								{#each task.subtasks as subtask (subtask.subtaskId)}
									{#if subtask.subtaskStatus != 'Completed' && subtask.subtaskStatus != 'Cancelled'}
										<div class="flex-shrink-0 rounded-lg bg-gray-50 p-3">
											<div class="flex items-center justify-between">
												<div class="min-w-0 flex-1">
													<p class="text-md truncate font-medium text-gray-900 lg:text-lg">
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
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
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
