// src/routes/api/tts/stream/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { ttsQueueManager } from '$lib/server/ttsQueueManager';

export const GET: RequestHandler = async () => {
	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection message
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

			// Listen for announcements
			const handleAnnouncement = (assignment: any) => {
				const message = `data: ${JSON.stringify({
					type: 'announcement',
					data: assignment
				})}\n\n`;

				try {
					controller.enqueue(encoder.encode(message));
				} catch (err) {
					console.error('[TTS SSE] Error sending announcement:', err);
				}
			};

			ttsQueueManager.on('play-announcement', handleAnnouncement);

			// Send keep-alive every 30 seconds
			const keepAliveInterval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keep-alive\n\n'));
				} catch (err) {
					clearInterval(keepAliveInterval);
				}
			}, 30000);

			// Cleanup on close
			return () => {
				ttsQueueManager.off('play-announcement', handleAnnouncement);
				clearInterval(keepAliveInterval);
				console.log('[TTS SSE] Client disconnected');
			};
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
