<script lang="ts">
	import { onMount } from 'svelte';
	import { RichSelect, DatePicker, DateRangePicker, Willow, Text } from 'wx-svelte-core';
	import { Editor, registerEditorItem } from 'wx-svelte-editor';
	import { Grid, getEditorConfig } from 'wx-svelte-grid';
	import { parseDate, dateToIso, formatDate } from '$lib/utils/dateUtils';
	import { SvelteDate } from 'svelte/reactivity';

	import { architectsStore, projectsStore, tasksStore, enumsStore } from '$lib/stores';
	import type { Task } from '$lib/types';

	// Grid API and state
	let api = $state();
	let dataToEdit = $state<Task | null>(null);

	// Reactive state from stores - use $derived with store snapshots
	let tasksState = $state({ list: [], loading: true, error: null });
	let architectsState = $state({ list: [], loading: true, error: null });
	let projectsState = $state({ list: [], loading: true, error: null });

	// Subscribe to stores
	$effect(() => {
		const unsubTasks = tasksStore.subscribe((state) => {
			tasksState = state;
		});
		return unsubTasks;
	});

	$effect(() => {
		const unsubArchitects = architectsStore.subscribe((state) => {
			architectsState = state;
		});
		return unsubArchitects;
	});

	$effect(() => {
		const unsubProjects = projectsStore.subscribe((state) => {
			projectsState = state;
		});
		return unsubProjects;
	});

	// Derived values from state
	let tasks = $derived(tasksState.list);
	let loading = $derived(tasksState.loading);
	let error = $derived(tasksState.error);
	let architectOptions = $derived(
		architectsState.list.map((a) => ({ id: a.architectId, label: a.architectName }))
	);
	let projectOptions = $derived(
		projectsState.list.map((p) => ({ id: p.projectId, label: p.projectName }))
	);

	// Dynamic options from enums
	let statusOptions = $state<Array<{ id: string; label: string }>>([]);
	let priorityOptions = $state<Array<{ id: string; label: string }>>([]);

	// Filter state
	let searchTerm = $state('');
	let statusFilter = $state('all');
	let priorityFilter = $state('all');
	let dueRange = $state<{ start: Date | null; end: Date | null }>({ start: null, end: null });

	// ----------------------
	// Load initial data on mount
	// ----------------------
	onMount(async () => {
		try {
			// Load all data in parallel

			await Promise.all([
				enumsStore.load().then((r) => {
					return r;
				}),
				architectsStore.load().then((r) => {
					return r;
				}),
				projectsStore.load().then((r) => {
					return r;
				}),
				tasksStore.load().then((r) => {
					return r;
				})
			]);

			// Update tasks with architect and project names
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);

			// Get enums from store
			const enumsState = $enumsStore;

			const enums = enumsState.value;

			if (enums) {
				// Map status options
				statusOptions = [
					{ id: 'all', label: 'All Status' },
					...(enums.status?.map((s: string) => ({ id: s, label: s })) || [])
				];

				// Map priority options
				priorityOptions = [
					{ id: 'all', label: 'All Priorities' },
					...(enums.priority?.map((p: string) => ({ id: p, label: p })) || [])
				];
			} else {
				console.warn('No enums data available');
			}
		} catch (err) {
			console.error('Failed to load data:', err);
		}
	});

	// Register custom editors
	registerEditorItem('richselect', RichSelect);
	registerEditorItem('datepicker', DatePicker);

	// Grid columns configuration
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
			options: statusOptions.filter((opt) => opt.id !== 'all'),
			width: 120,
			template: (v: string | null) => v || 'Planning',
			sort: true
		},
		{
			id: 'taskPriority',
			header: 'Priority',
			editor: 'richselect',
			options: priorityOptions.filter((opt) => opt.id !== 'all'),
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
		}
	]);

	// Initialize grid API and event handlers
	const init = (gridApi: any) => {
		api = gridApi;

		// Intercept editor opening to use external editor
		gridApi.intercept('open-editor', ({ id }: { id: string }) => {
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
		gridApi.on('select-row', ({ id }: { id: string }) => {
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

	// Filter function
	function createFilter(filterValues: {
		searchTerm: string;
		statusFilter: string;
		priorityFilter: string;
		dueRange: { start: Date | null; end: Date | null };
	}) {
		const { searchTerm, statusFilter, priorityFilter, dueRange } = filterValues;

		return (task: Task) => {
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

	// Handle save (create or update)
	async function handleSave(values: Partial<Task>) {
		try {
			if (dataToEdit?.taskId) {
				// Update existing task
				const updated = await tasksStore.update(dataToEdit.taskId, values);
				if (api) {
					api.exec('update-row', {
						id: dataToEdit.taskId,
						row: updated
					});
				}
			} else {
				// Create new task - ensure required fields
				if (!values.taskName || !values.projectId || !values.architectId) {
					throw new Error('Task name, project, and architect are required');
				}

				await tasksStore.create({
					taskName: values.taskName,
					projectId: values.projectId,
					architectId: values.architectId,
					taskDescription: values.taskDescription || null,
					taskStartDate: dateToIso(values.taskStartDate as any) || null,
					taskDueDate: dateToIso(values.taskDueDate as any) || null,
					taskStatus: values.taskStatus || 'Planning',
					taskPriority: values.taskPriority || 'Medium'
				});
			}
			closeEditor();
		} catch (err) {
			console.error('Save failed:', err);
			alert(err instanceof Error ? err.message : 'Failed to save task');
		}
	}

	// Handle delete
	async function handleDelete() {
		if (!dataToEdit?.taskId) return;

		try {
			await tasksStore.remove(dataToEdit.taskId);
			if (api) {
				api.exec('delete-row', { id: dataToEdit.taskId });
			}
			closeEditor();
		} catch (err) {
			console.error('Delete failed:', err);
			alert('Failed to delete task');
		}
	}

	// Handle add new task
	function handleAddTask() {
		dataToEdit = {
			taskId: '',
			taskName: '',
			taskDescription: null,
			taskStatus: 'Planning',
			taskPriority: 'Medium',
			taskStartDate: new Date().toISOString(),
			taskDueDate: null,
			architectId: '',
			architectName: '',
			projectId: '',
			projectName: ''
		} as any;
	}
</script>

<Willow>
	<div class="tasks-container">
		<div class="header">
			<h2>Tasks Management</h2>
			<div class="controls mb-4 flex flex-row items-center gap-4">
				<Text css="height: 100%;" clear bind:value={searchTerm} onchange={handleFilter} />
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
					onclick={handleAddTask}
				>
					+ Add Task
				</button>
			</div>
		</div>

		{#if loading}
			<div class="loading">Loading tasks...</div>
		{:else if error}
			<div class="error">Error: {error}</div>
		{:else if !tasks || tasks.length === 0}
			<div
				class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-2xl font-bold text-yellow-700"
			>
				<p>No tasks added.</p>
			</div>
		{:else}
			<Grid data={tasks} {columns} bind:this={api} {init} selection="row" autoheight={true} />
		{/if}
		{#if dataToEdit}
			<Editor
				values={dataToEdit}
				items={getEditorConfig(columns)}
				placement="modal"
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
					await handleSave(values);
				}}
				onaction={({ item }) => {
					if (item.id === 'delete') {
						handleDelete();
					}
					if (item.id === 'close') {
						closeEditor();
					}
				}}
			/>
		{/if}
	</div>
</Willow>
