// src/routes/api/tts/stream/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { ttsQueueManager } from '$lib/server/ttsQueueManager';

export const GET: RequestHandler = async () => {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let isClosed = false;

			// Helper to safely enqueue
			const safeEnqueue = (data: Uint8Array) => {
				if (!isClosed) {
					try {
						controller.enqueue(data);
					} catch (err) {
						console.error('[TTS SSE] Error enqueueing:', err);
						isClosed = true;
					}
				}
			};

			// Send initial connection message
			safeEnqueue(encoder.encode('data: {"type":"connected"}\n\n'));

			// Listen for announcements
			const handleAnnouncement = (assignment: any) => {
				const message = `data: ${JSON.stringify({
					type: 'announcement',
					data: assignment
				})}\n\n`;
				safeEnqueue(encoder.encode(message));
			};

			ttsQueueManager.on('announcement', handleAnnouncement);

			// Send keep-alive every 30 seconds
			const keepAliveInterval = setInterval(() => {
				safeEnqueue(encoder.encode(': keep-alive\n\n'));
			}, 30000);

			// Cleanup function
			const cleanup = () => {
				isClosed = true;
				ttsQueueManager.off('announcement', handleAnnouncement);
				clearInterval(keepAliveInterval);
				console.log('[TTS SSE] Client disconnected');
			};

			// Handle client disconnect
			return cleanup;
		},
		cancel() {
			console.log('[TTS SSE] Stream cancelled');
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
