// src/routes/api/tts/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { text, voice, speed } = await request.json();

    if (!text) {
      return json({ error: 'Text is required' }, { status: 400 });
    }

    // Call Kokoro TTS API
    // You'll need to install kokoro-tts or use their API
    // For now, this is a placeholder that would connect to your Kokoro TTS service

    const kokoroResponse = await fetch('http://localhost:8000/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice: voice || 'af_bella', // default voice
        speed: speed || 1.0,
        lang: 'en-us'
      })
    });

    if (!kokoroResponse.ok) {
      throw new Error('Kokoro TTS service error');
    }

    // Get audio data
    const audioBuffer = await kokoroResponse.arrayBuffer();

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
