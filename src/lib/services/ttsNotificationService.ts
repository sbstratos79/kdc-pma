// src/lib/services/ttsNotificationService.ts

import { TTSQueue } from '$lib/services/ttsQueue';

type TTSSettings = {
	engine: 'browser' | 'server';
	enabled: boolean;
	speed: number;
	browserVoice: string | null;
	serverVoice: string;
};

type TaskAssignment = {
	taskId: string;
	taskName: string;
	taskDescription: string | null;
	architectId: string;
	architectName: string;
	projectName: string;
};

export type ServerTTSVoice = string;

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
	private queue: TTSQueue<TaskAssignment>;
	private isBrowser: boolean = false;

	constructor() {
		this.isBrowser = typeof window !== 'undefined';

		this.queue = new TTSQueue<TaskAssignment>({ estimateDelay: () => 500 });
		this.queue.onPlay(async (assignment) => {
			await this.playAnnouncement(assignment);
		});

		if (this.isBrowser) {
			if ('speechSynthesis' in window) {
				this.synth = window.speechSynthesis;
				this.initBrowserVoice();
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ('AudioContext' in window || 'webkitAudioContext' in (window as any)) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			}
			this.loadSettings();
		}
	}

	/** Call from onMount */
	init() {
		if (this.isBrowser && !this.eventSource) {
			this.connectToSSE();
		}
	}

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

	private queueAnnouncement(assignment: TaskAssignment) {
		if (!this.settings.enabled) {
			console.log('[TTS Client] Announcements disabled, skipping');
			return;
		}

		console.log('[TTS Client] Queue size:', this.queue.length + 1);
		this.queue.enqueue(assignment);
	}

	private async playAnnouncement(assignment: TaskAssignment) {
		const message = `New task for ${assignment.architectName}: ${assignment.taskName} for ${assignment.projectName}. ${assignment.taskDescription}`;
		console.log('[TTS Client] Playing:', message);

		if (this.settings.engine === 'server') {
			await this.announceWithServerTTS(message);
		} else {
			await this.announceWithBrowser(message);
		}
	}

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

	private saveSettings() {
		if (typeof localStorage === 'undefined') return;

		try {
			localStorage.setItem('tts-settings', JSON.stringify(this.settings));
			console.log('[TTS Client] Saved settings');
		} catch (err) {
			console.error('[TTS Client] Failed to save settings:', err);
		}
	}

	getSettings(): TTSSettings {
		return { ...this.settings };
	}

	updateSettings(newSettings: Partial<TTSSettings>) {
		this.settings = { ...this.settings, ...newSettings };
		this.saveSettings();
		console.log('[TTS Client] Updated settings:', this.settings);
	}

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

	setEnabled(enabled: boolean) {
		this.settings.enabled = enabled;
		this.saveSettings();
		console.log(`[TTS Client] ${enabled ? 'Enabled' : 'Disabled'}`);

		if (!enabled) {
			this.stopAll();
		}
	}

	private stopAll() {
		if (this.synth) {
			this.synth.cancel();
		}
		this.queue.clear();
	}

	isAvailable(): boolean {
		return this.synth !== null || this.audioContext !== null;
	}

	getBrowserVoices(): SpeechSynthesisVoice[] {
		if (!this.synth) return [];
		return this.synth.getVoices().filter((v) => v.lang.startsWith('en'));
	}

	async test() {
		await this.playAnnouncement({
			taskId: 'test',
			taskName: 'Test Task',
			taskDescription: 'Test Task Description',
			architectId: 'test-arch',
			architectName: 'John Doe',
			projectName: 'Test Project'
		});
	}

	disconnect() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
			console.log('[TTS Client] Disconnected from SSE');
		}
		this.stopAll();
	}
}

export const ttsNotificationService = new TTSNotificationService();
