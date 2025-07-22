<script>
	import { Grid } from 'wx-svelte-grid';

	import { projectData } from '$lib/stores.js';
</script>

<Grid {projectData} />
