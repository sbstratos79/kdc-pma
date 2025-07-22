<script>
	import ArchitectGrid from '$lib/components/ArchitectGrid.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';

	let { data } = $props();
	let { architectDataValues, projectDataValues } = data;
</script>

<div class="flex flex-col items-start justify-center gap-4 xl:flex-row">
	<ArchitectGrid {architectDataValues} />
	<ProjectGrid {projectDataValues} />
</div>
