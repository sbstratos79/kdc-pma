<script lang="ts">
	import { onMount } from 'svelte';
	import { RichSelect, DatePicker, DateRangePicker, Willow, Text } from 'wx-svelte-core';
	import { Editor, registerEditorItem } from 'wx-svelte-editor';
	import { Grid, getEditorConfig } from 'wx-svelte-grid';
	import { parseDate, dateToIso, formatDate } from '$lib/utils/dateUtils';
	import { SvelteDate } from 'svelte/reactivity';

	import { projectsStore, enumsStore } from '$lib/stores';
	import type { Project } from '$lib/types';

	// Grid API and state
	let api = $state();
	let dataToEdit = $state<Project | null>(null);

	// Reactive state from stores - use $derived with store snapshots
	let projectsState = $state({ list: [], loading: true, error: null });

	// Subscribe to stores
	$effect(() => {
		const unsubProjects = projectsStore.subscribe((state) => {
			projectsState = state;
		});
		return unsubProjects;
	});

	// Derived values from state
	let projects = $derived(projectsState.list);
	let loading = $derived(projectsState.loading);
	let error = $derived(projectsState.error);

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
				projectsStore.load().then((r) => {
					return r;
				})
			]);

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
			id: 'projectId',
			header: 'ID',
			width: 80,
			readonly: true,
			hidden: true
		},
		{
			id: 'projectName',
			header: 'Project Name',
			editor: 'text',
			width: 200,
			flexgrow: 1
		},
		{
			id: 'projectDescription',
			header: 'Description',
			editor: 'textarea',
			width: 450,
			template: (v: string | null) => v || 'No description'
		},
		{
			id: 'projectStatus',
			header: 'Status',
			editor: 'richselect',
			options: statusOptions.filter((opt) => opt.id !== 'all'),
			width: 120,
			template: (v: string | null) => v || 'Planning',
			sort: true
		},
		{
			id: 'projectPriority',
			header: 'Priority',
			editor: 'richselect',
			options: priorityOptions.filter((opt) => opt.id !== 'all'),
			width: 100,
			sort: true
		},
		{
			id: 'projectStartDate',
			header: 'Start Date',
			width: 120,
			editor: 'datepicker',
			template: formatDate,
			sort: true
		},
		{
			id: 'projectDueDate',
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
				projectStartDate: parseDate(rawData.projectStartDate),
				projectDueDate: parseDate(rawData.projectDueDate)
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
						projectStartDate: parseDate(rawData.projectStartDate),
						projectDueDate: parseDate(rawData.projectDueDate)
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

		return (project: Project) => {
			// Search across multiple fields
			const matchesSearch =
				!searchTerm ||
				[
					project.projectName || '',
					project.projectDescription || '',
					project.projectName || ''
				].some((field) => field.toLowerCase().includes(searchTerm.toLowerCase()));

			// Status filter
			const matchesStatus = statusFilter === 'all' || project.projectStatus === statusFilter;

			// Priority filter
			const matchesPriority =
				priorityFilter === 'all' || project.projectPriority === priorityFilter;

			// Due date range filter
			const matchesDue = (() => {
				if (!dueRange || (!dueRange.start && !dueRange.end)) return true;
				const d = parseDate(project.projectDueDate);
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
	async function handleSave(values: Partial<Project>) {
		try {
			if (dataToEdit?.projectId) {
				// Update existing project
				const updated = await projectsStore.update(dataToEdit.projectId, values);
				if (api) {
					api.exec('update-row', {
						id: dataToEdit.projectId,
						row: updated
					});
				}
			} else {
				// Create new project - ensure required fields
				if (!values.projectName) {
					throw new Error('Project name is required');
				}

				await projectsStore.create({
					projectId: '',
					projectName: values.projectName,
					projectDescription: values.projectDescription || null,
					projectStartDate: dateToIso(values.projectStartDate as any) || null,
					projectDueDate: dateToIso(values.projectDueDate as any) || null,
					projectStatus: values.projectStatus || 'Planning',
					projectPriority: values.projectPriority || 'Medium'
				});
			}
			closeEditor();
		} catch (err) {
			console.error('Save failed:', err);
			alert(err instanceof Error ? err.message : 'Failed to save project');
		}
	}

	// Handle delete
	async function handleDelete() {
		if (!dataToEdit?.projectId) return;

		try {
			await projectsStore.remove(dataToEdit.projectId);
			if (api) {
				api.exec('delete-row', { id: dataToEdit.projectId });
			}
			closeEditor();
		} catch (err) {
			console.error('Delete failed:', err);
			alert('Failed to delete project');
		}
	}

	// Handle add new project
	function handleAddProject() {
		dataToEdit = {
			projectId: '',
			projectName: '',
			projectDescription: null,
			projectStatus: 'Planning',
			projectPriority: 'Medium',
			projectStartDate: new Date().toISOString(),
			projectDueDate: null
		} as any;
	}
</script>

<Willow>
	<div class="project-container">
		<div class="header">
			<h2>Projects Management</h2>
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
					class="add-btn w-[420px] rounded-md bg-blue-500 p-2 text-white"
					onclick={handleAddProject}
				>
					+ Add Project
				</button>
			</div>
		</div>

		{#if loading}
			<div class="loading">Loading projects...</div>
		{:else if error}
			<div class="error">Error: {error}</div>
		{:else if !projects || projects.length === 0}
			<div
				class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-2xl font-bold text-yellow-700"
			>
				<p>No projects added.</p>
			</div>
		{:else}
			<Grid data={projects} {columns} bind:this={api} {init} selection="row" autoheight={true} />
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
							disabled: !dataToEdit.projectId
						},
						{
							comp: 'button',
							type: 'primary',
							text: dataToEdit.projectId ? 'Update' : 'Create',
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
