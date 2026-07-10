<script lang="ts">
	import { page } from '$app/stores';
	import TTSSettings from '$lib/components/TTSSettings.svelte';
</script>

<div class="max-w-[98%] p-4">
	<TTSSettings authenticated={$page.data.authenticated} />
</div>
