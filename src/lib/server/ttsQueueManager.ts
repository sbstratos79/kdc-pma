// src/lib/server/ttsQueueManager.ts
import { EventEmitter } from 'events';

interface TaskAssignment {
	taskId: string;
	taskName: string;
	architectId: string;
	architectName: string;
	projectName: string;
	timestamp: number;
}

class TTSQueueManager extends EventEmitter {
	private seenTaskIds: Set<string> = new Set();
	private announcementQueue: TaskAssignment[] = [];
	private isProcessing: boolean = false;
	private serverStartTime: number;
	private initialized: boolean = false;

	constructor() {
		super();
		this.serverStartTime = Date.now();
		console.log('[TTS Queue] Manager initialized at', new Date(this.serverStartTime).toISOString());
	}

	/**
	 * Initialize with existing tasks (mark as seen, don't announce)
	 */
	initialize(tasks: any[]) {
		if (this.initialized) return;

		tasks.forEach((task) => {
			if (task.architectId && task.architectName) {
				this.seenTaskIds.add(task.taskId);
			}
		});

		this.initialized = true;
		console.log(`[TTS Queue] Initialized with ${this.seenTaskIds.size} existing tasks`);
	}

	/**
	 * Check for new assignments and queue them
	 */
	checkForNewAssignments(tasks: any[]) {
		if (!this.initialized) {
			console.log('[TTS Queue] Not initialized yet, skipping check');
			return;
		}

		const now = Date.now();
		const newAssignments: TaskAssignment[] = [];

		tasks.forEach((task) => {
			// Only consider tasks that:
			// 1. Have an architect assigned
			// 2. Haven't been seen before
			// 3. Were created after server start (to avoid announcing old tasks on restart)
			if (task.architectId && task.architectName && !this.seenTaskIds.has(task.taskId)) {
				// Check if task was created after server start
				// Assume taskId contains timestamp or check creation date if available
				const sqlTimestamp = task.addedTime;
				const jsTimestamp = sqlTimestamp
					? new Date(sqlTimestamp.replace(' ', 'T') + 'Z').getTime()
					: null;
				const oneMinuteInMs = 60 * 1000;

				if (jsTimestamp) {
					if (now - jsTimestamp <= oneMinuteInMs && jsTimestamp <= now) {
						newAssignments.push({
							taskId: task.taskId,
							taskName: task.taskName,
							architectId: task.architectId,
							architectName: task.architectName,
							projectName: task.projectName || '',
							timestamp: now
						});
						this.seenTaskIds.add(task.taskId);
					}
				}
			}
		});

		if (newAssignments.length > 0) {
			console.log(`[TTS Queue] Found ${newAssignments.length} new assignments:`, newAssignments);
			this.queueAnnouncements(newAssignments);
		}
	}

	/**
	 * Add announcements to queue
	 */
	private queueAnnouncements(assignments: TaskAssignment[]) {
		this.announcementQueue.push(...assignments);
		console.log(`[TTS Queue] Queue size: ${this.announcementQueue.length}`);

		// Emit event for all connected clients
		assignments.forEach((assignment) => {
			this.emit('announcement', assignment);
		});

		// Start processing if not already processing
		if (!this.isProcessing) {
			this.processQueue();
		}
	}

	/**
	 * Process announcements one by one with delays
	 */
	private async processQueue() {
		if (this.isProcessing || this.announcementQueue.length === 0) return;

		this.isProcessing = true;
		console.log('[TTS Queue] Starting queue processing');

		while (this.announcementQueue.length > 0) {
			const assignment = this.announcementQueue.shift()!;

			console.log('[TTS Queue] Processing announcement:', assignment);

			// Emit to clients to play the announcement
			this.emit('play-announcement', assignment);

			// Wait for estimated speech duration + buffer
			// Rough estimate: 150ms per word + 1s buffer
			const wordCount =
				assignment.taskName.split(' ').length +
				assignment.architectName.split(' ').length +
				assignment.projectName.split(' ').length +
				4; // "New task for" and "for"
			const estimatedDuration = wordCount * 150 + 1000;

			await this.delay(estimatedDuration);
		}

		this.isProcessing = false;
		console.log('[TTS Queue] Queue processing complete');
	}

	/**
	 * Helper delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get queue status
	 */
	getStatus() {
		return {
			queueLength: this.announcementQueue.length,
			isProcessing: this.isProcessing,
			seenTasksCount: this.seenTaskIds.size,
			initialized: this.initialized,
			serverStartTime: this.serverStartTime
		};
	}

	/**
	 * Clear seen tasks (for testing)
	 */
	clearSeenTasks() {
		this.seenTaskIds.clear();
		console.log('[TTS Queue] Cleared seen tasks');
	}

	/**
	 * Reset queue
	 */
	resetQueue() {
		this.announcementQueue = [];
		this.isProcessing = false;
		console.log('[TTS Queue] Queue reset');
	}
}

// Export singleton
export const ttsQueueManager = new TTSQueueManager();
