<script lang="ts">
	import { getStatusBarColor, getPriorityColor } from '$lib/utils/colorUtils';

	const statuses = ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'] as const;
	const priorities = ['High', 'Medium', 'Low'] as const;
</script>

<div
	class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
>
	<span class="font-semibold text-gray-700">Statuses:</span>
	{#each statuses as status}
		<span class="inline-flex items-center gap-1">
			<span class="inline-block h-3.5 w-1.5 rounded-sm {getStatusBarColor(status)}"></span>
			{status}
		</span>
	{/each}
	<span class="mx-1 text-gray-300">|</span>
	<span class="font-semibold text-gray-700">Priorities:</span>
	{#each priorities as priority}
		<span class="inline-flex items-center gap-1">
			<span class="inline-block h-2 w-2 rounded-full {getPriorityColor(priority)}"></span>
			{priority}
		</span>
	{/each}
</div>
