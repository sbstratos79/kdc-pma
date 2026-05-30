// src/lib/services/ttsQueue.ts
//
// Generic sequential queue for TTS announcements.
// Used by both server (ttsQueueManager) and client (ttsNotificationService).

export class TTSQueue<T> {
	private queue: T[] = [];
	private processing = false;
	private playFn: ((item: T) => Promise<void>) | null = null;
	private delayFn: (ms: number) => Promise<void>;
	private estimateDelay: (item: T) => number;

	constructor(options: {
		delay?: (ms: number) => Promise<void>;
		estimateDelay?: (item: T) => number;
	}) {
		this.delayFn = options.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		this.estimateDelay = options.estimateDelay ?? (() => 500);
	}

	onPlay(callback: (item: T) => Promise<void>): void {
		this.playFn = callback;
	}

	enqueue(item: T): void {
		this.queue.push(item);
		if (!this.processing) {
			this.process();
		}
	}

	enqueueMany(items: T[]): void {
		this.queue.push(...items);
		if (!this.processing) {
			this.process();
		}
	}

	private async process(): Promise<void> {
		if (this.processing || this.queue.length === 0) return;

		this.processing = true;

		while (this.queue.length > 0) {
			const item = this.queue.shift()!;

			if (this.playFn) {
				await this.playFn(item);
			}

			const delay = this.estimateDelay(item);
			if (delay > 0) {
				await this.delayFn(delay);
			}
		}

		this.processing = false;
	}

	get isProcessing(): boolean {
		return this.processing;
	}

	get length(): number {
		return this.queue.length;
	}

	clear(): void {
		this.queue = [];
		this.processing = false;
	}
}
