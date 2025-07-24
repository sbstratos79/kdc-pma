<script>
	import { onMount, onDestroy } from 'svelte';
	import { getEditorConfig, Willow, Grid } from 'wx-svelte-grid';
	import { DatePicker, RichSelect } from 'wx-svelte-core';
	import { Editor, registerEditorItem } from 'wx-svelte-editor';

	import {
		ptsDataStore,
		projectData,
		statusOptions,
		priorityOptions
	} from '$lib/stores/ptsDataStore';

	onMount(async () => {
		ptsDataStore.ensureInitialized();
	});

	onDestroy(() => {
		ptsDataStore.stopPolling();
	});

	let projectDataValues = $derived(
		$projectData.map((project) => ({
			projectId: project.projectId,
			projectName: project.projectName,
			projectStatus: project.projectStatus,
			projectStartDate: project.projectStartDate,
			projectDueDate: project.projectDueDate,
			projectPriority: project.projectPriority,
			projectDescription: project.projectDescription
		}))
	);

	console.log($statusOptions);
	// You can also create other derived values
	let statusOptionsArray = $derived($statusOptions);
	let priorityOptionsArray = $derived($priorityOptions);

	let dataToEdit = $state(null);
	const init = () => {
		return (dataToEdit = projectDataValues.filter((project) => project.projectId === dataToEdit));
	};

	const columns = [
		{
			id: 'projectId',
			width: 350
		},
		{
			id: 'projectName',
			width: 200,
			header: 'Name',
			editor: 'text'
		},
		{
			id: 'projectStatus',
			width: 150,
			header: 'Status',
			sort: true,
			editor: 'richselect',
			options: statusOptionsArray
		},
		{
			id: 'projectStartDate',
			width: 150,
			header: 'Start Date',
			sort: true,
			editor: 'datepicker',
			template: (v) => (v ? v.toLocaleDateString() : '')
		},
		{
			id: 'projectDueDate',
			width: 150,
			header: 'Due Date',
			sort: true,
			editor: 'datepicker',
			template: (v) => (v ? v.toLocaleDateString() : '')
		},
		{
			id: 'projectPriority',
			width: 250,
			header: 'Priority',
			sort: true,
			editor: 'richselect',
			options: priorityOptionsArray
		},
		{
			id: 'projectDescription',
			width: 750,
			header: 'Description',
			editor: 'textarea'
		}
	];
	const items = getEditorConfig(columns);
	registerEditorItem('richselect', RichSelect);
	registerEditorItem('datepicker', DatePicker);
</script>

<div class="flex items-center justify-center">
	<Willow>
		<Grid data={projectDataValues} {columns} {init} />
	</Willow>
</div>

{#if dataToEdit}
	<Editor
		values={dataToEdit}
		{items}
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
					id: 'delete'
				},
				{
					comp: 'button',
					type: 'primary',
					text: 'Save',
					id: 'save'
				}
			]
		}}
		placement="sidebar"
	/>
{/if}
