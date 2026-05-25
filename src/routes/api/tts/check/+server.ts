// src/routes/api/tts/check/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { catchHandler } from '$lib/server/api-utils';
import { ttsQueueManager } from '$lib/server/ttsQueueManager';

export const POST: RequestHandler = ({ request }) => {
	return catchHandler(async () => {
		const { tasks, initialize } = await request.json();

		if (!tasks || !Array.isArray(tasks)) {
			return json({ error: 'Invalid tasks data' }, { status: 400 });
		}

		if (initialize || !ttsQueueManager.getStatus().initialized) {
			ttsQueueManager.initialize(tasks);
			return json({ message: 'Initialized', status: ttsQueueManager.getStatus() });
		}

		ttsQueueManager.checkForNewAssignments(tasks);

		return json({
			message: 'Checked for new assignments',
			status: ttsQueueManager.getStatus()
		});
	}, 'TTS check failed');
};
