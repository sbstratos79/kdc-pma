import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { catchHandler } from '$lib/server/api-utils';
import { ttsQueueManager } from '$lib/server/ttsQueueManager';

export const POST: RequestHandler = async ({ request }) => {
	return catchHandler(async () => {
		const body = await request.json();
		const text = (body.text ?? '').trim();

		if (!text) {
			return json({ error: 'text is required' }, { status: 400 });
		}

		ttsQueueManager.broadcastCustomAnnouncement(text);
		return json({ data: { sent: true } });
	}, 'Failed to send announcement');
};
