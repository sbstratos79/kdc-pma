<script lang="ts">
	let { size = 'md' }: { size?: 'sm' | 'md' | 'lg' } = $props();
	const sizes = { sm: 'h-12 w-12', md: 'h-16 w-16', lg: 'h-20 w-20' };
</script>

<div class="flex h-64 items-center justify-center">
	<div class="animate-spin rounded-full border-b-2 border-blue-600 {sizes[size]}"></div>
</div>
