<script lang="ts">
	import { onMount } from 'svelte';
	import { ttsNotificationService } from '$lib/services/ttsNotificationService';

	let ttsEnabled = $state(true);
	let ttsAvailable = $state(false);
	let currentVoice = $state<string | null>(null);

	onMount(() => {
		ttsAvailable = ttsNotificationService.isAvailable();

		// Wait a bit for voices to load
		setTimeout(() => {
			currentVoice = ttsNotificationService.getCurrentVoice();
		}, 100);
	});

	function toggleTTS() {
		ttsEnabled = !ttsEnabled;
		ttsNotificationService.setEnabled(ttsEnabled);

		// Save preference to localStorage
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('tts-enabled', String(ttsEnabled));
		}
	}

	function testTTS() {
		ttsNotificationService.test();
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<div class="flex items-center justify-between">
		<div class="flex-1">
			<h3 class="text-lg font-semibold text-gray-900">Task Announcements</h3>
			<p class="mt-1 text-sm text-gray-600">
				{#if ttsAvailable}
					Get spoken notifications when new tasks are assigned
					{#if currentVoice}
						<span class="mt-1 block text-xs text-gray-500">Voice: {currentVoice}</span>
					{/if}
				{:else}
					Text-to-speech is not available in your browser
				{/if}
			</p>
		</div>

		{#if ttsAvailable}
			<div class="flex items-center gap-3">
				<button
					onclick={testTTS}
					class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
				>
					Test
				</button>

				<button
					onclick={toggleTTS}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {ttsEnabled
						? 'bg-blue-600'
						: 'bg-gray-200'}"
					role="switch"
					aria-checked={ttsEnabled}
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {ttsEnabled
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>
		{/if}
	</div>
</div>
