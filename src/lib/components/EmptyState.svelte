<script lang="ts">
	let { message }: { message: string } = $props();
</script>

<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
	<p>{message}</p>
</div>
