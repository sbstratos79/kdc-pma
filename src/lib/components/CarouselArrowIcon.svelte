<script lang="ts">
	let { direction = 'right' }: { direction?: 'left' | 'right' | 'up' | 'down' } = $props();
	const paths: Record<string, string> = {
		left: 'm15 18-6-6 6-6',
		right: 'm9 18 6-6-6-6',
		up: 'm18 15-6-6-6 6',
		down: 'm6 9 6 6 6-6'
	};
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="24"
	height="24"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class="text-gray-800"
>
	<path d={paths[direction]} />
</svg>
