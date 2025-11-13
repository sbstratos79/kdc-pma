<script lang="ts">
	import { onMount } from 'svelte';
	import { ttsNotificationService } from '$lib/services/ttsNotificationService';

	let ttsEnabled = $state(true);
	let ttsAvailable = $state(false);
	let speed = $state(0.9);

	// Browser TTS
	let browserVoices = $state<SpeechSynthesisVoice[]>([]);
	let selectedBrowserVoice = $state<string>('');

	onMount(() => {
		ttsAvailable = ttsNotificationService.isAvailable();

		// Load current settings
		const settings = ttsNotificationService.getSettings();
		ttsEnabled = settings.enabled;
		speed = settings.speed;
		selectedBrowserVoice = settings.browserVoice || '';

		// Load browser voices
		setTimeout(() => {
			browserVoices = ttsNotificationService.getBrowserVoices();
		}, 100);
	});

	function toggleTTS() {
		ttsEnabled = !ttsEnabled;
		ttsNotificationService.setEnabled(ttsEnabled);
	}

	function handleSpeedChange(event: Event) {
		const target = event.target as HTMLInputElement;
		speed = parseFloat(target.value);
		ttsNotificationService.updateSettings({ speed });
	}

	function handleBrowserVoiceChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedBrowserVoice = target.value;
		ttsNotificationService.updateSettings({ browserVoice: target.value });
	}

	async function testTTS() {
		await ttsNotificationService.test();
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<div class="flex-1">
			<h3 class="text-lg font-semibold text-gray-900">Task Announcements</h3>
			<p class="mt-1 text-sm text-gray-600">
				{#if ttsAvailable}
					Get spoken notifications when new tasks are assigned
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

	{#if ttsAvailable && ttsEnabled}
		<!-- Controls -->
		<div class="space-y-4 border-t border-gray-200 pt-4">
			<!-- Speed Control -->
			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">
					Speed: {speed.toFixed(1)}x
				</label>
				<input
					type="range"
					min="0.5"
					max="2.0"
					step="0.1"
					value={speed}
					onchange={handleSpeedChange}
					class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
				/>
				<div class="mt-1 flex justify-between text-xs text-gray-500">
					<span>0.5x</span>
					<span>1.0x</span>
					<span>2.0x</span>
				</div>
			</div>

			<!-- Browser Voice Selection -->
			<div>
				<label for="browser-voice" class="mb-2 block text-sm font-medium text-gray-700">
					Browser Voice
				</label>
				<select
					id="browser-voice"
					value={selectedBrowserVoice}
					onchange={handleBrowserVoiceChange}
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				>
					{#if browserVoices.length === 0}
						<option value="">Loading voices...</option>
					{:else}
						{#each browserVoices as voice}
							<option value={voice.name}>
								{voice.name} ({voice.lang})
							</option>
						{/each}
					{/if}
				</select>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Custom range slider styling */
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		background: #2563eb;
		border-radius: 50%;
		cursor: pointer;
	}

	input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #2563eb;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}
</style>
