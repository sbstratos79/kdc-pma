// src/lib/server/ttsQueueManager.ts
import { EventEmitter } from 'events';
import { TTSQueue } from '$lib/services/ttsQueue';

interface TaskAssignment {
	taskId: string;
	taskName: string;
	taskDescription: string;
	architectId: string;
	architectName: string;
	projectName: string;
	timestamp: number;
}

class TTSQueueManager extends EventEmitter {
	private seenTaskIds: Set<string> = new Set();
	private queue: TTSQueue<TaskAssignment>;
	private serverStartTime: number;
	private initialized: boolean = false;

	constructor() {
		super();
		this.serverStartTime = Date.now();
		this.setMaxListeners(100);

		this.queue = new TTSQueue<TaskAssignment>({
			estimateDelay: (assignment) => {
				const wordCount =
					assignment.taskName.split(' ').length +
					assignment.architectName.split(' ').length +
					assignment.projectName.split(' ').length +
					4;
				return wordCount * 150 + 1000;
			}
		});

		this.queue.onPlay(async (assignment) => {
			this.emit('play-announcement', assignment);
		});

		console.log('[TTS Queue] Manager initialized at', new Date(this.serverStartTime).toISOString());
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	checkForNewAssignments(tasks: any[]) {
		if (!this.initialized) {
			console.log('[TTS Queue] Not initialized yet, skipping check');
			return;
		}

		const now = Date.now();
		const newAssignments: TaskAssignment[] = [];

		tasks.forEach((task) => {
			if (task.architectId && task.architectName && !this.seenTaskIds.has(task.taskId)) {
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
							taskDescription: task.taskDescription,
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
			newAssignments.forEach((a) => this.emit('announcement', a));
			this.queue.enqueueMany(newAssignments);
		}
	}

	getStatus() {
		return {
			queueLength: this.queue.length,
			isProcessing: this.queue.isProcessing,
			seenTasksCount: this.seenTaskIds.size,
			initialized: this.initialized,
			serverStartTime: this.serverStartTime
		};
	}

	/** For testing */
	clearSeenTasks() {
		this.seenTaskIds.clear();
		console.log('[TTS Queue] Cleared seen tasks');
	}

	resetQueue() {
		this.queue.clear();
		console.log('[TTS Queue] Queue reset');
	}
}

export const ttsQueueManager = new TTSQueueManager();
