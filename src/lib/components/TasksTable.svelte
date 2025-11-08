<script lang="ts">
	import { onMount } from 'svelte';
	import { RichSelect, DatePicker, DateRangePicker, Willow, Text } from 'wx-svelte-core';
	import { Editor, registerEditorItem } from 'wx-svelte-editor';
	import { Grid, getEditorConfig } from 'wx-svelte-grid';
	// import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';

	import { SvelteDate } from 'svelte/reactivity';

	import { 
		taskData, 
		architectData, 
		projectData,
		statusOptions as statusEnum, 
		priorityOptions as priorityEnum 
	} from '$lib/stores/ptsDataStore';
	import type { Subtask, Task } from '$lib/types';

	let api = $state();
	let loading = $state(true);
	let error: string | null = $state(null);
	let tasks = $state<Task[]>([]);

	// Dynamic options - will be populated on mount
	let statusOptions = $state<Array<{id: string, label: string}>>([]);
	let priorityOptions = $state<Array<{id: string, label: string}>>([]);
	let architectOptions = $state<Array<{id: string, label: string}>>([]);
	let projectOptions = $state<Array<{id: string, label: string}>>([]);

	// Load data on mount
	onMount(async () => {
		try {
			// Load tasks
			const data = $taskData;
			tasks = data || [];

			// Load architects dynamically from ptsStore
			const architects = $architectData;
			architectOptions = [
				...(architects?.map(arch => ({
					id: arch.architectId,
					label: arch.architectName
				})) || [])
			];

			// Load projects dynamically from ptsStore
			const projects = $projectData;
			projectOptions = [
				...(projects?.map(project => ({
					id: project.projectId,
					label: project.projectName
				})) || [])
			];

			// Load status options from ptsStore
			const statuses = $statusEnum;
			statusOptions = [
				{ id: 'all', label: 'All Status' },
				...(statuses?.map(status => ({
					id: status,
					label: status
				})) || [])
			];

			// Load priority options from ptsStore
			const priorities = $priorityEnum;
			priorityOptions = [
				{ id: 'all', label: 'All Priorities' },
				...(priorities?.map(priority => ({
					id: priority,
					label: priority
				})) || [])
			];

		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			}
		} finally {
			loading = false;
		}
	});

	// Register custom editors
	registerEditorItem('richselect', RichSelect);
	registerEditorItem('datepicker', DatePicker);

	// Helper function to convert date strings to Date objects
	const parseDate = (value: Date | string | null) => {
		if (!value) return null;
		if (value instanceof Date) return value;
		if (typeof value === 'string') {
			const date = new Date(value);
			return isNaN(date.getTime()) ? null : date;
		}
		return null;
	};

	// Grid columns configuration - reactive to options loading
	let columns = $derived([
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
			template: (v: string | null) => v || 'No description'
		},
		{
			id: 'architectId',
			header: 'Architect',
			width: 120,
			sort: true,
			editor: 'richselect',
			options: architectOptions
		},
		{
			id: 'projectId',
			header: 'Project',
			width: 150,
			sort: true,
			editor: 'richselect',
			options: projectOptions
		},
		{
			id: 'taskStatus',
			header: 'Status',
			editor: 'richselect',
			options: statusOptions.filter(opt => opt.id !== 'all'),
			width: 120,
			template: (v: string | null) => v || 'Planning',
			sort: true
		},
		{
			id: 'taskPriority',
			header: 'Priority',
			editor: 'richselect',
			options: priorityOptions.filter(opt => opt.id !== 'all'),
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
			template: (v: Subtask) => (Array.isArray(v) ? `${v.length} items` : '0 items'),
			sort: true
		}
	]);

	let dataToEdit = $state(null);

	// Initialize grid API and event handlers
	const init = (gridApi) => {
		api = gridApi;

		// Intercept editor opening to use external editor
		gridApi.intercept('open-editor', ({ id }) => {
			const rawData = gridApi.getRow(id);
			// Convert date strings to Date objects for the editor
			dataToEdit = {
				...rawData,
				taskStartDate: parseDate(rawData.taskStartDate),
				taskDueDate: parseDate(rawData.taskDueDate)
			};
			return false;
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
		const response = await fetch('/api/delete-task', {
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

	// Filter and search functionality
	let searchTerm = $state('');
	let statusFilter = $state('all');
	let priorityFilter = $state('all');
	let dueRange = $state({ start: null, end: null });

	// Create filter function based on current filter values
	function createFilter(filterValues) {
		const { searchTerm, statusFilter, priorityFilter, dueRange } = filterValues;

		return (task) => {
			// Search across multiple fields
			const matchesSearch =
				!searchTerm ||
				[
					task.taskName || '',
					task.taskDescription || '',
					task.projectName || '',
					task.architectName || ''
				].some((field) => field.toLowerCase().includes(searchTerm.toLowerCase()));

			// Status filter
			const matchesStatus = statusFilter === 'all' || task.taskStatus === statusFilter;

			// Priority filter
			const matchesPriority = priorityFilter === 'all' || task.taskPriority === priorityFilter;

			// Due date range filter
			const matchesDue = (() => {
				if (!dueRange || (!dueRange.start && !dueRange.end)) return true;
				const d = parseDate(task.taskDueDate);
				if (!d) return false;
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

	// Handle filter changes
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
				<DateRangePicker
					title="Date Range"
					placeholder="Pick a date"
					align="center"
					bind:value={dueRange}
					clear
					onchange={handleFilter}
				/>
				<button
					class="add-btn w-[400px] rounded-md bg-blue-500 p-2 text-white"
					onclick={() =>
						(dataToEdit = {
							taskId: null,
							taskName: '',
							taskDescription: '',
							taskStatus: 'Planning',
							taskPriority: 'Medium',
							taskStartDate: new Date(),
							taskDueDate: null,
							architectId: null,
							projectId: null,
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
			<Grid data={tasks} {columns} bind:this={api} {init} selection="row" autoheight={true} />

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
								await updateTask(dataToEdit.taskId, values);
								api.exec('update-row', {
									id: dataToEdit.taskId,
									row: values
								});
							} else {
								const newTask = await createTask(values);
								tasks = [...tasks, newTask];
							}
							closeEditor();
						} catch (err) {
							console.error('Save failed:', err);
						}
					}}
					onaction={({ item }) => {
						if (item.id === 'delete' && dataToEdit.taskId) {
							deleteTask(dataToEdit.taskId)
								.then(() => {
									api.exec('delete-row', { id: dataToEdit.taskId });
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
