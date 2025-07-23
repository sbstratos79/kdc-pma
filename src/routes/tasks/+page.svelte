<script>
	import { Willow, Grid } from 'wx-svelte-grid';

	let { data } = $props();

	let { projectDataValues, status, priority } = data;

	let projectData = projectDataValues.map((projectData) => {
		return {
			projectId: projectData.projectId,
			projectName: projectData.projectName,
			projectStatus: projectData.projectStatus,
			projectStartDate: projectData.projectStartDate,
			projectDueDate: projectData.projectDueDate,
			projectPriority: projectData.projectPriority,
			projectDescription: projectData.projectDescription
		};
	});
	console.log(priority);

	const columns = [
		{
			id: 'projectId',
			width: 50
		},
		{
			id: 'projectName',
			width: 200,
			header: 'Name',
			footer: 'Name',
			editor: 'text'
		},
		{
			id: 'projectStatus',
			width: 150,
			header: 'Status',
			footer: 'Status',
			sort: true,
			editor: {
				type: 'combo',
				config: { template: (option) => option },
				options: status
			}
		},
		{
			id: 'projectStartDate',
			width: 150,
			header: 'Start Date',
			footer: 'Start Date',
			sort: true
		},
		{
			id: 'projectDueDate',
			width: 150,
			header: 'Due Date',
			footer: 'Due Date',
			sort: true
		},
		{
			id: 'projectPriority',
			width: 250,
			header: 'Priority',
			footer: 'Priority',
			sort: true,
			editor: {
				type: 'combo',
				config: { template: (option) => option },
				options: priority
			}
		},
		{
			id: 'projectDescription',
			width: 450,
			header: 'Description',
			footer: 'Description'
		}
	];
</script>

<Willow>
	<Grid data={projectData} {columns} />
</Willow>
