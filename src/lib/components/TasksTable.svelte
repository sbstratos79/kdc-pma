<script lang="ts">
	import { onMount } from 'svelte';
	import { RichSelect, DatePicker, DateRangePicker, Willow, Text } from 'wx-svelte-core';
	import { Editor, registerEditorItem } from 'wx-svelte-editor';
	import { Grid, getEditorConfig } from 'wx-svelte-grid';
	import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';

	import { SvelteDate } from 'svelte/reactivity';

	import { taskData } from '$lib/stores/ptsDataStore';
	import type { Task } from '$lib/types';

	let api = $state();
	let loading = $state(true);
	let error = $state(null);
	let tasks = $state<Task[]>([]);

	// Status and priority options
	const statusOptions = [
		{ id: 'all', label: 'All Status' },
		{ id: 'Planning', label: 'Planning' },
		{ id: 'In Progress', label: 'In Progress' },
		{ id: 'Completed', label: 'Completed' },
		{ id: 'On Hold', label: 'On Hold' },
		{ id: 'Cancelled', label: 'Cancelled' }
	];

	const priorityOptions = [
		{ id: 'all', label: 'All Priorities' },
		{ id: 'High', label: 'High' },
		{ id: 'Medium', label: 'Medium' },
		{ id: 'Low', label: 'Low' }
	];

	// Register custom editors
	registerEditorItem('richselect', RichSelect);
	registerEditorItem('datepicker', DatePicker);

	// Helper function to convert date strings to Date objects
	const parseDate = (value) => {
		if (!value) return null;
		if (value instanceof Date) return value;
		if (typeof value === 'string') {
			const date = new Date(value);
			return isNaN(date.getTime()) ? null : date;
		}
		return null;
	};

	// Grid columns configuration
	const columns = [
		{
			id: 'taskId',
			header: 'ID',
			width: 80,
			readonly: true,
			hidden: true
		},
		{
			id: 'taskName',
			header: 'Task Name',
			editor: 'text',
			width: 200,
			flexgrow: 1
		},
		{
			id: 'taskDescription',
			header: 'Description',
			editor: 'textarea',
			width: 450,
			template: (v) => v || 'No description'
		},
		{
			id: 'architectFirstName',
			header: 'Architect',
			width: 120,
			readonly: true,
			sort: true
		},
		{
			id: 'projectName',
			header: 'Project',
			width: 150,
			readonly: true,
			sort: true
		},
		{
			id: 'taskStatus',
			header: 'Status',
			editor: 'richselect',
			options: statusOptions,
			width: 120,
			template: (v) => v || 'Planning',
			sort: true
		},
		{
			id: 'taskPriority',
			header: 'Priority',
			editor: 'richselect',
			options: priorityOptions,
			width: 100,
			sort: true
		},
		{
			id: 'taskStartDate',
			header: 'Start Date',
			width: 120,
			editor: 'datepicker',
			template: formatDate,
			sort: true
		},
		{
			id: 'taskDueDate',
			header: 'Due Date',
			width: 120,
			editor: 'datepicker',
			template: formatDate,
			sort: true
		},
		{
			id: 'subtasks',
			header: 'Subtasks',
			width: 100,
			readonly: true,
			template: (v) => (Array.isArray(v) ? `${v.length} items` : '0 items'),
			sort: true
		}
	];

	let dataToEdit = $state(null);

	// Initialize grid API and event handlers
	const init = (gridApi) => {
		api = gridApi; // Store API reference for filtering

		// Intercept editor opening to use external editor
		gridApi.intercept('open-editor', ({ id }) => {
			const rawData = gridApi.getRow(id);
			// Convert date strings to Date objects for the editor
			dataToEdit = {
				...rawData,
				taskStartDate: parseDate(rawData.taskStartDate),
				taskDueDate: parseDate(rawData.taskDueDate)
			};
			return false; // Prevent default inline editor
		});

		// Update external editor when row selection changes
		gridApi.on('select-row', ({ id }) => {
			if (dataToEdit) {
				const rawData = id ? gridApi.getRow(id) : null;
				if (rawData) {
					dataToEdit = {
						...rawData,
						taskStartDate: parseDate(rawData.taskStartDate),
						taskDueDate: parseDate(rawData.taskDueDate)
					};
				} else {
					dataToEdit = null;
				}
			}
		});
	};

	// API functions
	async function updateTask(taskId: string, updates: Partial<Task>) {
		const response = await fetch('/api/pts', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'task',
				id: taskId,
				data: updates
			})
		});

		if (!response.ok) {
			throw new Error('Failed to update task');
		}

		// Update local data
		const taskIndex = tasks.findIndex((t) => t.taskId === taskId);
		if (taskIndex !== -1) {
			tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
		}
	}

	async function deleteTask(taskId: string) {
		const response = await fetch('/api/pts', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'task',
				id: taskId
			})
		});

		if (!response.ok) {
			throw new Error('Failed to delete task');
		}
	}

	async function createTask(taskData: Partial<Task>) {
		const response = await fetch('/api/pts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'task',
				data: taskData
			})
		});

		if (!response.ok) {
			throw new Error('Failed to create task');
		}

		const result = await response.json();
		return result.data;
	}

	// Load data on mount
	onMount(async () => {
		try {
			const data = await $taskData;
			tasks = data || [];
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	// Filter and search functionality using external filters (SVAR pattern)
	let searchTerm = $state('');
	let statusFilter = $state('all');
	let priorityFilter = $state('all');
	let dueRange = $state({ start: null, end: null });

	// Create filter function based on current filter values
	function createFilter(filterValues) {
		const { searchTerm, statusFilter, priorityFilter, dueRange } = filterValues;

		return (task) => {
			// Search across multiple fields (title, description, project, architect name)
			const matchesSearch =
				!searchTerm ||
				[
					task.taskName || '',
					task.taskDescription || '',
					task.projectName || '',
					task.architectFirstName || ''
				].some((field) => field.toLowerCase().includes(searchTerm.toLowerCase()));

			// Status filter
			const matchesStatus = statusFilter === 'all' || task.taskStatus === statusFilter;

			// Priority filter
			const matchesPriority = priorityFilter === 'all' || task.taskPriority === priorityFilter;

			// Due date range filter
			const matchesDue = (() => {
				if (!dueRange || (!dueRange.start && !dueRange.end)) return true;
				const d = parseDate(task.taskDueDate);
				if (!d) return false; // tasks without a due date don't match a range filter
				let start = dueRange.start ? new SvelteDate(dueRange.start) : null;
				if (start) start.setHours(0, 0, 0, 0);
				let end = dueRange.end ? new SvelteDate(dueRange.end) : null;
				if (end) end.setHours(23, 59, 59, 999);

				if (start && end) return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
				if (start) return d.getTime() >= start.getTime();
				if (end) return d.getTime() <= end.getTime();
				return true;
			})();

			return matchesSearch && matchesStatus && matchesPriority && matchesDue;
		};
	}

	// Handle filter changes using SVAR Grid's filter-rows action
	function handleFilter() {
		if (!api) return;

		const filterValues = {
			searchTerm,
			statusFilter,
			priorityFilter,
			dueRange
		};

		const filter = createFilter(filterValues);
		api.exec('filter-rows', { filter });
	}

	// Close editor function
	function closeEditor() {
		dataToEdit = null;
	}
</script>

<Willow>
	<div class="tasks-container">
		<div class="header">
			<h2>Tasks Management</h2>
			<div class="controls flex flex-row items-center gap-4">
				<Text class="h-full" clear bind:value={searchTerm} onchange={handleFilter} />
				<RichSelect
					options={statusOptions}
					onchange={handleFilter}
					clear
					bind:value={statusFilter}
				/>
				<RichSelect
					options={priorityOptions}
					onchange={handleFilter}
					clear
					bind:value={priorityFilter}
				/>
				<DateRangePicker align="center" bind:value={dueRange} clear onchange={handleFilter} />
				<button
					class="add-btn w-[400px] rounded-md bg-blue-500 p-2 text-white"
					onclick={() =>
						(dataToEdit = {
							taskId: null,
							taskName: '',
							taskDescription: '',
							taskStatus: 'Planning',
							taskPriority: 'Medium',
							taskStartDate: new Date(), // Use proper Date object
							taskDueDate: null,
							architectFirstName: null,
							projectName: null,
							subtasks: []
						})}
				>
					+ Add Task
				</button>
			</div>
		</div>

		{#if loading}
			<div class="loading">Loading tasks...</div>
		{:else if error}
			<div class="error">Error: {error}</div>
		{:else}
			<Grid
				data={tasks}
				{columns}
				bind:this={api}
				{init}
				selection="row"
				autoheight={true}
			/>

			{#if dataToEdit}
				<Editor
					values={dataToEdit}
					items={getEditorConfig(columns)}
					placement="sidebar"
					topBar={{
						items: [
							{
								comp: 'icon',
								icon: 'wxi-close',
								id: 'close'
							},
							{ comp: 'spacer' },
							{
								comp: 'button',
								type: 'danger',
								text: 'Delete',
								id: 'delete',
								disabled: !dataToEdit.taskId
							},
							{
								comp: 'button',
								type: 'primary',
								text: dataToEdit.taskId ? 'Update' : 'Create',
								id: 'save'
							}
						]
					}}
					onsave={async ({ values }) => {
						try {
							if (dataToEdit.taskId) {
								// Update existing task via API
								await updateTask(dataToEdit.taskId, values);
								// Also update the grid
								api.exec('update-row', {
									id: dataToEdit.taskId,
									row: values
								});
							} else {
								// Create new task
								const newTask = await createTask(values);
								tasks = [...tasks, newTask];
							}
							closeEditor();
						} catch (err) {
							console.error('Save failed:', err);
							// Optionally show error notification
						}
					}}
					onaction={({ item }) => {
						if (item.id === 'delete' && dataToEdit.taskId) {
							deleteTask(dataToEdit.taskId)
								.then(() => {
									// Remove from grid
									api.exec('delete-row', { id: dataToEdit.taskId });
									// Remove from local tasks
									tasks = tasks.filter((task) => task.taskId !== dataToEdit.taskId);
									closeEditor();
								})
								.catch((err) => {
									console.error('Delete failed:', err);
								});
						}
						if (item.id === 'close') {
							closeEditor();
						}
					}}
				/>
			{/if}
		{/if}
	</div>
</Willow>

<!-- <style> -->
<!-- 	.tasks-container { -->
<!-- 		padding: 20px; -->
<!-- 		max-width: 100%; -->
<!-- 	} -->
<!---->
<!-- 	.header { -->
<!-- 		display: flex; -->
<!-- 		justify-content: space-between; -->
<!-- 		align-items: flex-end; -->
<!-- 		margin-bottom: 20px; -->
<!-- 		flex-wrap: wrap; -->
<!-- 		gap: 20px; -->
<!-- 	} -->
<!---->
<!-- 	/* .controls { */ -->
<!-- 	/* 	display: flex; */ -->
<!-- 	/* 	gap: 15px; */ -->
<!-- 	/* 	align-items: flex-end; */ -->
<!-- 	/* 	flex-wrap: wrap; */ -->
<!-- 	/* } */ -->
<!-- 	/**/ -->
<!-- 	/* .add-btn { */ -->
<!-- 	/* 	padding: 8px 16px; */ -->
<!-- 	/* 	background-color: #007bff; */ -->
<!-- 	/* 	color: white; */ -->
<!-- 	/* 	border: none; */ -->
<!-- 	/* 	border-radius: 4px; */ -->
<!-- 	/* 	cursor: pointer; */ -->
<!-- 	/* 	font-size: 14px; */ -->
<!-- 	/* 	font-weight: 500; */ -->
<!-- 	/* 	height: fit-content; */ -->
<!-- 	/* 	align-self: flex-end; */ -->
<!-- 	/* } */ -->
<!---->
<!-- 	.add-btn:hover { -->
<!-- 		background-color: #0056b3; -->
<!-- 	} -->
<!---->
<!-- 	.loading, -->
<!-- 	.error { -->
<!-- 		padding: 20px; -->
<!-- 		text-align: center; -->
<!-- 		font-size: 16px; -->
<!-- 	} -->
<!---->
<!-- 	.error { -->
<!-- 		color: #dc3545; -->
<!-- 		background-color: #f8d7da; -->
<!-- 		border: 1px solid #f5c6cb; -->
<!-- 		border-radius: 4px; -->
<!-- 	} -->
<!---->
<!-- 	.loading { -->
<!-- 		color: #6c757d; -->
<!-- 	} -->
<!---->
<!-- 	h2 { -->
<!-- 		margin: 0; -->
<!-- 		color: #333; -->
<!-- 		font-size: 24px; -->
<!-- 		font-weight: 600; -->
<!-- 	} -->
<!---->
<!-- 	/* Ensure proper spacing for the grid container */ -->
<!-- 	:global(.wx-willow) { -->
<!-- 		margin-top: 10px; -->
<!-- 	} -->
<!---->
<!-- 	/* Style the filter fields to look consistent */ -->
<!-- 	:global(.controls .wx-field) { -->
<!-- 		min-width: 200px; -->
<!-- 	} -->
<!---->
<!-- 	:global(.controls .wx-field label) { -->
<!-- 		font-size: 12px; -->
<!-- 		color: #666; -->
<!-- 		margin-bottom: 4px; -->
<!-- 	} -->
<!-- 	:global(.wx-header) { -->
<!-- 	background: #000; -->
<!-- 	} -->
<!-- </style> -->
<style>
	:global(.wx-header) {
		background: #eeee;
	}
</style>
