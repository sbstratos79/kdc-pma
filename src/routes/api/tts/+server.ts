// src/routes/api/tts/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { text, voice, speed } = await request.json();

		if (!text) {
			return json({ error: 'Text is required' }, { status: 400 });
		}

		// Call Edge TTS API
		const edgeResponse = await fetch('http://localhost:5050/v1/audio/speech', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer your_api_key_here'
			},
			body: JSON.stringify({
				input: text,
				voice: voice || 'en-IN-PrabhatNeural',
				response_format: 'wav',
				speed: speed || 1.0
			})
		});

		if (!edgeResponse.ok) {
			throw new Error('Edge TTS service error');
		}

		// Get audio data
		const audioBuffer = await edgeResponse.arrayBuffer();

		// Return audio as base64
		const base64Audio = Buffer.from(audioBuffer).toString('base64');

		return json({
			audio: base64Audio,
			contentType: 'audio/wav'
		});
	} catch (error) {
		console.error('TTS API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'TTS generation failed' },
			{ status: 500 }
		);
	}
};
