// src/routes/api/tts/check/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ttsQueueManager } from '$lib/server/ttsQueueManager';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { tasks, initialize } = await request.json();

    if (!tasks || !Array.isArray(tasks)) {
      return json({ error: 'Invalid tasks data' }, { status: 400 });
    }

    // If this is the first call, initialize with existing tasks
    if (initialize || !ttsQueueManager.getStatus().initialized) {
      ttsQueueManager.initialize(tasks);
      return json({ message: 'Initialized', status: ttsQueueManager.getStatus() });
    }

    // Otherwise, check for new assignments
    ttsQueueManager.checkForNewAssignments(tasks);

    return json({
      message: 'Checked for new assignments',
      status: ttsQueueManager.getStatus()
    });
  } catch (error) {
    console.error('[TTS Check] Error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};
