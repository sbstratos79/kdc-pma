// src/lib/services/ttsNotificationService.ts

interface Task {
  taskId: string;
  taskName: string;
  architectId: string;
  architectName: string;
  projectName: string;
}

export type TTSEngine = 'browser' | 'kokoro';
export type KokoroVoice =
  | 'af_bella'
  | 'af_sarah'
  | 'am_adam'
  | 'am_michael'
  | 'bf_emma'
  | 'bf_isabella'
  | 'bm_george'
  | 'bm_lewis'
  | 'hf_alpha'
  | 'hf_beta'
  | 'hm_omega'
  | 'hm_psi';

export interface TTSSettings {
  engine: TTSEngine;
  enabled: boolean;
  speed: number;
  // Browser TTS settings
  browserVoice: string | null;
  // Kokoro TTS settings
  kokoroVoice: KokoroVoice;
}

class TTSNotificationService {
  private synth: SpeechSynthesis | null = null;
  private seenTaskIds: Set<string> = new Set();
  private settings: TTSSettings = {
    engine: 'browser',
    enabled: true,
    speed: 0.9,
    browserVoice: null,
    kokoroVoice: 'af_bella'
  };
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.initBrowserVoice();
      }
      // Initialize Web Audio API for Kokoro
      if ('AudioContext' in window || 'webkitAudioContext' in (window as any)) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      this.loadSettings();
    }
  }

  /**
   * Initialize and select the best browser voice
   */
  private initBrowserVoice() {
    if (!this.synth) return;

    const setVoice = () => {
      const voices = this.synth!.getVoices();

      // Prefer Microsoft Edge voices
      const edgeVoice = voices.find((v) => v.name.includes('Microsoft') && v.lang.startsWith('en'));

      const englishVoice = voices.find((v) => v.lang.startsWith('en'));

      this.settings.browserVoice = (edgeVoice || englishVoice || voices[0])?.name || null;

      console.log('TTS Browser Voice selected:', this.settings.browserVoice);
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
        console.log('TTS: Loaded settings', this.settings);
      }
    } catch (err) {
      console.error('TTS: Failed to load settings', err);
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings() {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem('tts-settings', JSON.stringify(this.settings));
      console.log('TTS: Saved settings', this.settings);
    } catch (err) {
      console.error('TTS: Failed to save settings', err);
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
    console.log('TTS: Updated settings', this.settings);
  }

  /**
   * Mark tasks as seen
   */
  initializeSeenTasks(tasks: Task[]) {
    tasks.forEach((task) => {
      if (task.architectId && task.architectName) {
        this.seenTaskIds.add(task.taskId);
      }
    });
    console.log(`TTS: Initialized with ${this.seenTaskIds.size} existing tasks`);
  }

  /**
   * Check for new task assignments and announce them
   */
  checkForNewAssignments(tasks: Task[]) {
    if (!this.settings.enabled) return;

    const newAssignments: Task[] = [];

    tasks.forEach((task) => {
      if (task.architectId && task.architectName && !this.seenTaskIds.has(task.taskId)) {
        newAssignments.push(task);
        this.seenTaskIds.add(task.taskId);
      }
    });

    if (newAssignments.length > 0) {
      console.log(`TTS: Found ${newAssignments.length} new assignments`, newAssignments);
      newAssignments.forEach((task) => this.announceTask(task));
    }
  }

  /**
   * Announce a single task assignment
   */
  private async announceTask(task: Task) {
    if (!this.settings.enabled) return;

    const message = `New task for ${task.architectName}: ${task.taskName} for ${task.projectName}`;
    console.log('TTS: Announcing:', message);

    if (this.settings.engine === 'kokoro') {
      await this.announceWithKokoro(message);
    } else {
      this.announceWithBrowser(message);
    }
  }

  /**
   * Announce using browser TTS
   */
  private announceWithBrowser(message: string) {
    if (!this.synth) return;

    const utterance = new SpeechSynthesisUtterance(message);

    // Find and set the voice
    if (this.settings.browserVoice) {
      const voices = this.synth.getVoices();
      const voice = voices.find((v) => v.name === this.settings.browserVoice);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = this.settings.speed;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onerror = (event) => {
      console.error('Browser TTS Error:', event);
    };

    utterance.onend = () => {
      console.log('Browser TTS: Announcement complete');
    };

    this.synth.cancel();
    this.synth.speak(utterance);
  }

  /**
   * Announce using Kokoro TTS
   */
  private async announceWithKokoro(message: string) {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          voice: this.settings.kokoroVoice,
          speed: this.settings.speed
        })
      });

      if (!response.ok) {
        throw new Error('Kokoro TTS request failed');
      }

      const { audio, contentType } = await response.json();

      // Stop any currently playing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // Create and play audio
      this.currentAudio = new Audio(`data:${contentType};base64,${audio}`);
      this.currentAudio.playbackRate = this.settings.speed;

      this.currentAudio.onended = () => {
        console.log('Kokoro TTS: Announcement complete');
        this.currentAudio = null;
      };

      this.currentAudio.onerror = (err) => {
        console.error('Kokoro TTS Audio Error:', err);
        this.currentAudio = null;
      };

      await this.currentAudio.play();
    } catch (err) {
      console.error('Kokoro TTS Error:', err);
      // Fallback to browser TTS
      console.log('Falling back to browser TTS');
      this.announceWithBrowser(message);
    }
  }

  /**
   * Enable or disable TTS announcements
   */
  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    this.saveSettings();
    console.log(`TTS: ${enabled ? 'Enabled' : 'Disabled'}`);

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
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
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
   * Clear the seen tasks
   */
  clearSeenTasks() {
    this.seenTaskIds.clear();
    console.log('TTS: Cleared seen tasks');
  }

  /**
   * Test the TTS with a sample message
   */
  async test() {
    await this.announceTask({
      taskId: 'test',
      taskName: 'Test Task',
      architectId: 'test-arch',
      architectName: 'John Doe',
      projectName: 'Test Project'
    });
  }
}

// Export singleton instance
export const ttsNotificationService = new TTSNotificationService();
