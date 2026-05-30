import type { RequestHandler } from '@sveltejs/kit';
import { entityChangeEmitter } from '$lib/server/entityChangeEmitter';

export const GET: RequestHandler = async () => {
	let streamCleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let isClosed = false;

			const safeEnqueue = (data: Uint8Array) => {
				if (!isClosed) {
					try {
						controller.enqueue(data);
					} catch (err) {
						console.error('[Entity SSE] Error enqueueing:', err);
						isClosed = true;
					}
				}
			};

			safeEnqueue(encoder.encode('data: {"type":"connected"}\n\n'));

			const handleChange = (event: { entity: string; action: string }) => {
				const message = `data: ${JSON.stringify({ type: 'change', ...event })}\n\n`;
				safeEnqueue(encoder.encode(message));
			};

			entityChangeEmitter.on('change', handleChange);

			const keepAliveInterval = setInterval(() => {
				safeEnqueue(encoder.encode(': keep-alive\n\n'));
			}, 30000);

			streamCleanup = () => {
				isClosed = true;
				entityChangeEmitter.off('change', handleChange);
				clearInterval(keepAliveInterval);
				console.log('[Entity SSE] Client disconnected');
			};
		},
		cancel() {
			streamCleanup?.();
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
