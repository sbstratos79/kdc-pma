<script lang="ts">
	import { onMount } from 'svelte';
	import { RichSelect, DatePicker, DateRangePicker, Willow, Text } from 'wx-svelte-core';
	import { Editor, registerEditorItem } from 'wx-svelte-editor';
	import { Grid, getEditorConfig } from 'wx-svelte-grid';
	import { parseDate, dateToIso, formatDate } from '$lib/utils/dateUtils';
	import { SvelteDate } from 'svelte/reactivity';

	import { architectsStore } from '$lib/stores';
	import type { Architect } from '$lib/types';

	// Grid API and state
	let api = $state();
	let dataToEdit = $state<Architect | null>(null);

	// Reactive state from stores - use $derived with store snapshots
	let architectsState = $state({ list: [], loading: true, error: null });

	// Subscribe to stores
	$effect(() => {
		const unsubArchitects = architectsStore.subscribe((state) => {
			architectsState = state;
		});
		return unsubArchitects;
	});

	// Derived values from state
	let architects = $derived(architectsState.list);
	let loading = $derived(architectsState.loading);
	let error = $derived(architectsState.error);

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
				architectsStore.load().then((r) => {
					return r;
				})
			]);
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
			id: 'architectId',
			header: 'ID',
			width: 80,
			readonly: true,
			hidden: true
		},
		{
			id: 'architectName',
			header: 'Architect Name',
			editor: 'text',
			width: 200,
			flexgrow: 1
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
				...rawData
			};
			return false;
		});

		// Update external editor when row selection changes
		gridApi.on('select-row', ({ id }: { id: string }) => {
			if (dataToEdit) {
				const rawData = id ? gridApi.getRow(id) : null;
				if (rawData) {
					dataToEdit = {
						...rawData
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
		dueRange: { start: Date | null; end: Date | null };
	}) {
		const { searchTerm } = filterValues;

		return (architect: Architect) => {
			// Search across multiple fields
			const matchesSearch =
				!searchTerm ||
				[architect.architectName || ''].some((field) =>
					field.toLowerCase().includes(searchTerm.toLowerCase())
				);

			return matchesSearch;
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
	async function handleSave(values: Partial<Architect>) {
		try {
			if (dataToEdit?.architectId) {
				// Update existing architect
				const updated = await architectsStore.update(dataToEdit.architectId, values);
				if (api) {
					api.exec('update-row', {
						id: dataToEdit.architectId,
						row: updated
					});
				}
			} else {
				// Create new architect - ensure required fields
				if (!values.architectName) {
					throw new Error('Architect name is required');
				}

				await architectsStore.create({
					architectId: values.architectId,
					architectName: values.architectName
				});
			}
			closeEditor();
		} catch (err) {
			console.error('Save failed:', err);
			alert(err instanceof Error ? err.message : 'Failed to save architect');
		}
	}

	// Handle delete
	async function handleDelete() {
		if (!dataToEdit?.architectId) return;

		try {
			await architectsStore.remove(dataToEdit.architectId);
			if (api) {
				api.exec('delete-row', { id: dataToEdit.architectId });
			}
			closeEditor();
		} catch (err) {
			console.error('Delete failed:', err);
			alert('Failed to delete architect');
		}
	}

	// Handle add new architect
	function handleAddArchitect() {
		dataToEdit = {
			architectId: '',
			architectName: ''
		} as any;
	}
</script>

<Willow>
	<div class="architects-container">
		<div class="header">
			<h2>Architects Management</h2>
			<div class="controls flex flex-row items-center gap-4">
				<Text class="h-full" clear bind:value={searchTerm} onchange={handleFilter} />
				<button
					class="add-btn w-[400px] rounded-md bg-blue-500 p-2 text-white"
					onclick={handleAddArchitect}
				>
					+ Add Architect
				</button>
			</div>
		</div>

		{#if loading}
			<div class="loading">Loading architects...</div>
		{:else if error}
			<div class="error">Error: {error}</div>
		{:else if !architects || architects.length === 0}
			<div class="no-data">
				<p>No architects found</p>
				<pre>Debug: architects= {JSON.stringify(architects, null, 2)}</pre>
			</div>
		{:else}
			<div class="debug-info">
				<p>Showing {architects.length} architects</p>
			</div>
			<Grid data={architects} {columns} bind:this={api} {init} selection="row" autoheight={true} />

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
								disabled: !dataToEdit.architectId
							},
							{
								comp: 'button',
								type: 'primary',
								text: dataToEdit.architectId ? 'Update' : 'Create',
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
		{/if}
	</div>
</Willow>
