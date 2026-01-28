// src/lib/services/ttsNotificationService.ts

class TTSNotificationService {
	private synth: SpeechSynthesis | null = null;
	private settings: TTSSettings = {
		engine: 'browser',
		enabled: true,
		speed: 1.0,
		browserVoice: null,
		serverVoice: 'en-IN-PrabhatNeural'
	};
	private audioContext: AudioContext | null = null;
	private eventSource: EventSource | null = null;
	private announcementQueue: TaskAssignment[] = [];
	private isPlaying: boolean = false;
	private isBrowser: boolean = false;

	constructor() {
		this.isBrowser = typeof window !== 'undefined';

		if (this.isBrowser) {
			if ('speechSynthesis' in window) {
				this.synth = window.speechSynthesis;
				this.initBrowserVoice();
			}
			if ('AudioContext' in window || 'webkitAudioContext' in (window as any)) {
				this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			}
			this.loadSettings();

			// Don't connect immediately - wait for component to mount
			// This will be called by the component
		}
	}

	/**
	 * Initialize the service (call this from onMount)
	 */
	init() {
		if (this.isBrowser && !this.eventSource) {
			this.connectToSSE();
		}
	}

	/**
	 * Connect to Server-Sent Events stream
	 */
	private connectToSSE() {
		if (!this.isBrowser) return;

		console.log('[TTS Client] Connecting to SSE...');

		try {
			this.eventSource = new EventSource('/api/tts/stream');

			this.eventSource.onopen = () => {
				console.log('[TTS Client] SSE connection established');
			};

			this.eventSource.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);

					if (message.type === 'connected') {
						console.log('[TTS Client] Connected to server');
					} else if (message.type === 'announcement') {
						console.log('[TTS Client] Received announcement:', message.data);
						this.queueAnnouncement(message.data);
					}
				} catch (err) {
					console.error('[TTS Client] Error parsing SSE message:', err);
				}
			};

			this.eventSource.onerror = (err) => {
				console.error('[TTS Client] SSE error:', err);
				this.eventSource?.close();
				this.eventSource = null;

				// Reconnect after 5 seconds
				setTimeout(() => {
					if (this.isBrowser) {
						console.log('[TTS Client] Reconnecting...');
						this.connectToSSE();
					}
				}, 5000);
			};
		} catch (err) {
			console.error('[TTS Client] Failed to create EventSource:', err);
		}
	}

	/**
	 * Queue an announcement to play
	 */
	private queueAnnouncement(assignment: TaskAssignment) {
		if (!this.settings.enabled) {
			console.log('[TTS Client] Announcements disabled, skipping');
			return;
		}

		this.announcementQueue.push(assignment);
		console.log('[TTS Client] Queue size:', this.announcementQueue.length);

		if (!this.isPlaying) {
			this.processQueue();
		}
	}

	/**
	 * Process announcement queue
	 */
	private async processQueue() {
		if (this.isPlaying || this.announcementQueue.length === 0) return;

		this.isPlaying = true;

		while (this.announcementQueue.length > 0) {
			const assignment = this.announcementQueue.shift()!;
			await this.playAnnouncement(assignment);

			// Small delay between announcements
			await this.delay(500);
		}

		this.isPlaying = false;
	}

	/**
	 * Play a single announcement
	 */
	private async playAnnouncement(assignment: TaskAssignment) {
		  const message = `New task for ${assignment.architectName}: ${assignment.taskName} for ${assignment.projectName}. ${assignment.taskDescription}`;
		console.log('[TTS Client] Playing:', message);

		if (this.settings.engine === 'server') {
			await this.announceWithServerTTS(message);
		} else {
			await this.announceWithBrowser(message);
		}
	}

	/**
	 * Initialize browser voice
	 */
	private initBrowserVoice() {
		if (!this.synth) return;

		const setVoice = () => {
			const voices = this.synth!.getVoices();
			const edgeVoice = voices.find((v) => v.name.includes('Microsoft') && v.lang.startsWith('en'));
			const englishVoice = voices.find((v) => v.lang.startsWith('en'));
			this.settings.browserVoice = (edgeVoice || englishVoice || voices[0])?.name || null;
			console.log('[TTS Client] Browser voice selected:', this.settings.browserVoice);
		};

		if (this.synth.getVoices().length > 0) {
			setVoice();
		} else {
			this.synth.addEventListener('voiceschanged', setVoice);
		}
	}

	/**
	 * Load settings from localStorage
	 */
	private loadSettings() {
		if (typeof localStorage === 'undefined') return;

		try {
			const saved = localStorage.getItem('tts-settings');
			if (saved) {
				const parsed = JSON.parse(saved);
				this.settings = { ...this.settings, ...parsed };
				console.log('[TTS Client] Loaded settings:', this.settings);
			}
		} catch (err) {
			console.error('[TTS Client] Failed to load settings:', err);
		}
	}

	/**
	 * Save settings to localStorage
	 */
	private saveSettings() {
		if (typeof localStorage === 'undefined') return;

		try {
			localStorage.setItem('tts-settings', JSON.stringify(this.settings));
			console.log('[TTS Client] Saved settings');
		} catch (err) {
			console.error('[TTS Client] Failed to save settings:', err);
		}
	}

	/**
	 * Get current settings
	 */
	getSettings(): TTSSettings {
		return { ...this.settings };
	}

	/**
	 * Update settings
	 */
	updateSettings(newSettings: Partial<TTSSettings>) {
		this.settings = { ...this.settings, ...newSettings };
		this.saveSettings();
		console.log('[TTS Client] Updated settings:', this.settings);
	}

	/**
	 * Announce using browser TTS
	 */
	private announceWithBrowser(message: string): Promise<void> {
		return new Promise((resolve) => {
			if (!this.synth) {
				resolve();
				return;
			}

			const utterance = new SpeechSynthesisUtterance(message);

			if (this.settings.browserVoice) {
				const voices = this.synth.getVoices();
				const voice = voices.find((v) => v.name === this.settings.browserVoice);
				if (voice) utterance.voice = voice;
			}

			utterance.rate = this.settings.speed;
			utterance.pitch = 1.0;
			utterance.volume = 1.0;

			utterance.onerror = (event) => {
				console.error('[TTS Client] Browser TTS error:', event);
				resolve();
			};

			utterance.onend = () => {
				console.log('[TTS Client] Browser TTS complete');
				resolve();
			};

			this.synth.cancel();
			this.synth.speak(utterance);
		});
	}

	/**
	 * Announce using Server TTS (Edge TTS)
	 */
	private async announceWithServerTTS(message: string): Promise<void> {
		try {
			const response = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: message,
					voice: this.settings.serverVoice,
					speed: this.settings.speed
				})
			});

			if (!response.ok) {
				throw new Error('Server TTS request failed');
			}

			const { audio, contentType } = await response.json();

			return new Promise((resolve, reject) => {
				const audioElement = new Audio(`data:${contentType};base64,${audio}`);
				audioElement.autoplay = true;
				// audioElement.muted = true;
				audioElement.playbackRate = this.settings.speed;

				audioElement.onended = () => {
					console.log('[TTS Client] Server TTS complete');
					resolve();
				};

				audioElement.onerror = (err) => {
					console.error('[TTS Client] Server TTS audio error:', err);
					reject(err);
				};

				audioElement.play().catch(() => {
					// fallback: listen for user gesture then play
					window.addEventListener(
						'click',
						() => {
							audioElement.muted = false;
							audioElement.play();
						},
						{ once: true }
					);
				});
			});
		} catch (err) {
			console.error('[TTS Client] Server TTS error, falling back to browser:', err);
			return this.announceWithBrowser(message);
		}
	}

	/**
	 * Helper delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Enable or disable TTS
	 */
	setEnabled(enabled: boolean) {
		this.settings.enabled = enabled;
		this.saveSettings();
		console.log(`[TTS Client] ${enabled ? 'Enabled' : 'Disabled'}`);

		if (!enabled) {
			this.stopAll();
		}
	}

	/**
	 * Stop all ongoing TTS
	 */
	private stopAll() {
		if (this.synth) {
			this.synth.cancel();
		}
		this.announcementQueue = [];
		this.isPlaying = false;
	}

	/**
	 * Check if TTS is available
	 */
	isAvailable(): boolean {
		return this.synth !== null || this.audioContext !== null;
	}

	/**
	 * Get available browser voices
	 */
	getBrowserVoices(): SpeechSynthesisVoice[] {
		if (!this.synth) return [];
		return this.synth.getVoices().filter((v) => v.lang.startsWith('en'));
	}

	/**
	 * Test the TTS
	 */
	async test() {
		await this.playAnnouncement({
			taskId: 'test',
			taskName: 'Test Task',
			architectId: 'test-arch',
			architectName: 'John Doe',
			projectName: 'Test Project'
		});
	}

	/**
	 * Disconnect SSE
	 */
	disconnect() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
			console.log('[TTS Client] Disconnected from SSE');
		}
		this.stopAll();
	}
}

// Export singleton instance
export const ttsNotificationService = new TTSNotificationService();
