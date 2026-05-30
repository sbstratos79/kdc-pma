<script lang="ts">
	let { title = 'Error loading data', message }: { title?: string; message: string } = $props();
</script>

<div class="alert-error">
	<h2 class="mb-2 font-semibold">{title}</h2>
	<p>{message}</p>
</div>
