<script lang="ts">
	import { onMount } from 'svelte';
	import { RichSelect, DatePicker, DateRangePicker, Willow, Text } from 'wx-svelte-core';
	import { Editor, registerEditorItem } from 'wx-svelte-editor';
	import { Grid, getEditorConfig } from 'wx-svelte-grid';
	// import { getPriorityColor, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';

	import { SvelteDate } from 'svelte/reactivity';

	import {
		// taskData,
		architectData,
		projectData,
		statusOptions as statusEnum,
		priorityOptions as priorityEnum
	} from '$lib/stores/ptsDataStore';
	import type { Subtask, Task } from '$lib/types';

	// Using the same $state pattern you had
	let api = $state();
	let loading = $state(true);
	let error: string | null = $state(null);
	let tasks = $state<Task[]>([]);

	// Dynamic options - will be populated on mount
	let statusOptions = $state<Array<{ id: string; label: string }>>([]);
	let priorityOptions = $state<Array<{ id: string; label: string }>>([]);
	let architectOptions = $state<Array<{ id: string; label: string }>>([]);
	let projectOptions = $state<Array<{ id: string; label: string }>>([]);

	// ----------------------
	// Helpers
	// ----------------------
	const parseDate = (value: Date | string | null) => {
		if (!value) return null;
		if (value instanceof Date) return value;
		if (typeof value === 'string') {
			const date = new Date(value);
			return isNaN(date.getTime()) ? null : date;
		}
		return null;
	};

	const dateToIso = (d: Date | string | null) => {
		if (!d) return null;
		if (d instanceof Date) return d.toISOString();
		if (typeof d === 'string') {
			// assume user typed ISO or readable string — try to parse
			const parsed = new Date(d);
			return isNaN(parsed.getTime()) ? null : parsed.toISOString();
		}
		return null;
	};

	// Normalize API response structure: expect { data: <...> }
	async function handleJsonResponse(res: Response) {
		if (!res.ok) {
			let msg = `Request failed: ${res.status}`;
			try {
				const json = await res.json();
				if (json?.error) msg = json.error;
				else if (json?.message) msg = json.message;
			} catch {
				/* ignore JSON parse errors */
			}
			throw new Error(msg);
		}
		return res.json();
	}

	// ----------------------
	// Data fetching + CRUD
	// ----------------------
	// Fetch tasks from server. Fallback to ptsDataStore if network fails.
	async function fetchTasks(): Promise<Task[]> {
		try {
			const res = await fetch('/api/tasks', { method: 'GET' });
			const json = await handleJsonResponse(res);
			// assume json.data is array of tasks
			return (json.data as Task[]) || [];
		} catch (err) {
			// fallback: use local store snapshot if available
			console.warn('fetchTasks failed, falling back to local store:', err);
			// const fallback = $taskData;
			return [];
		}
	}

	async function fetchEnums(): Promise<Task[]> {
		try {
			const res = await fetch('/api/enums', { method: 'GET' });
			const json = await handleJsonResponse(res);
			const { priority, status } = json.data;
			// assume json.data is array of tasks
			return (priority, status);
		} catch (err) {
			// fallback: use local store snapshot if available
			console.warn('fetchTasks failed, falling back to local store:', err);
			// const fallback = $taskData;
			return [];
		}
	}

	// Create task
	async function createTask(taskDataInput: Partial<Task>) {
		const payload = {
			// map to the DB/endpoint shape (dates -> ISO strings)
			name: taskDataInput.taskName ?? '',
			description: taskDataInput.taskDescription ?? null,
			startDate: dateToIso(taskDataInput.taskStartDate as any) ?? null,
			dueDate: dateToIso(taskDataInput.taskDueDate as any) ?? null,
			status: taskDataInput.taskStatus ?? 'Planning',
			priority: taskDataInput.taskPriority ?? 'Medium',
			projectId: taskDataInput.projectId ?? null,
			architectId: taskDataInput.architectId ?? null
		};

		const res = await fetch('/api/tasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const json = await handleJsonResponse(res);
		// Expect created task in json.data
		const created: Task = mapServerTaskToDto(json.data);
		// update local state
		tasks = [...tasks, created];
		return created;
	}

	// Update task
	async function updateTask(taskId: string, updates: Partial<Task>) {
		// prepare payload only with changed fields that the API expects
		const payload: any = {};
		if ('taskName' in updates) payload.name = updates.taskName;
		if ('taskDescription' in updates) payload.description = updates.taskDescription ?? null;
		if ('taskStartDate' in updates) payload.startDate = dateToIso(updates.taskStartDate as any);
		if ('taskDueDate' in updates) payload.dueDate = dateToIso(updates.taskDueDate as any);
		if ('taskStatus' in updates) payload.status = updates.taskStatus;
		if ('taskPriority' in updates) payload.priority = updates.taskPriority;
		if ('projectId' in updates) payload.projectId = updates.projectId;
		if ('architectId' in updates) payload.architectId = updates.architectId;

		const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const json = await handleJsonResponse(res);
		const updated: Task = mapServerTaskToDto(json.data);

		// update local list
		tasks = tasks.map((t) => (t.taskId === taskId ? { ...t, ...updated } : t));
		return updated;
	}

	// Delete task
	async function deleteTask(taskId: string) {
		const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
			method: 'DELETE'
		});
		await handleJsonResponse(res);
		// update local list
		tasks = tasks.filter((t) => t.taskId !== taskId);
	}

	// Map server DB row -> frontend DTO (Task). Adjust fields to match your server response.
	function mapServerTaskToDto(serverRow: any): Task {
		// serverRow is expected to include taskId, name, description, startDate, dueDate, status, priority, projectId, architectId
		return {
			architectId: serverRow.architectId ?? serverRow.architect_id ?? '',
			architectName: serverRow.architectName ?? serverRow.architect_name ?? '',
			taskId: serverRow.taskId ?? serverRow.task_id ?? serverRow.id ?? '',
			taskName: serverRow.name ?? '',
			taskDescription: serverRow.description ?? null,
			taskStartDate: serverRow.startDate ?? serverRow.start_date ?? null,
			taskDueDate: serverRow.dueDate ?? serverRow.due_date ?? null,
			taskStatus: serverRow.status ?? '',
			taskPriority: serverRow.priority ?? '',
			projectId: serverRow.projectId ?? serverRow.project_id ?? '',
			projectName: serverRow.projectName ?? serverRow.project_name ?? '',
			subtasks: (serverRow.subtasks ?? []).map((s: any) => ({
				subtaskId: s.subtaskId ?? s.subtask_id ?? s.id ?? '',
				subtaskName: s.name,
				subtaskDescription: s.description ?? null,
				subtaskStatus: s.status ?? '',
				taskId: s.taskId ?? s.task_id ?? serverRow.taskId ?? '',
				taskName: serverRow.name ?? ''
			}))
		};
	}

	// ----------------------
	// Load initial data on mount
	// ----------------------
	onMount(async () => {
		try {
			loading = true;
			// fetch tasks from server (preferred)
			tasks = await fetchTasks();

			// Load architects dynamically from ptsStore (as fallback / initial options)
			const architects = $architectData;
			architectOptions = [
				...(architects?.map((arch) => ({
					id: arch.architectId,
					label: arch.architectName
				})) || [])
			];

			// Load projects dynamically from ptsStore
			const projects = $projectData;
			projectOptions = [
				...(projects?.map((project) => ({
					id: project.projectId,
					label: project.projectName
				})) || [])
			];

			// Load status options from ptsStore
			const statuses = $statusEnum;
			statusOptions = [
				{ id: 'all', label: 'All Status' },
				...(statuses?.map((status) => ({
					id: status,
					label: status
				})) || [])
			];

			// Load priority options from ptsStore
			const priorities = $priorityEnum;
			priorityOptions = [
				{ id: 'all', label: 'All Priorities' },
				...(priorities?.map((priority) => ({
					id: priority,
					label: priority
				})) || [])
			];
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = String(err);
			}
		} finally {
			loading = false;
		}
	});

	// Register custom editors
	registerEditorItem('richselect', RichSelect);
	registerEditorItem('datepicker', DatePicker);

	// Grid columns configuration - same as original but stays reactive to options loading
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

	// Filter and search functionality (unchanged)
	let searchTerm = $state('');
	let statusFilter = $state('all');
	let priorityFilter = $state('all');
	let dueRange = $state({ start: null, end: null });

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
								// If API returns server-supplied IDs & fields, add it
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
