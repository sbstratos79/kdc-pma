// src/routes/api/tts/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { text, voice, speed } = await request.json();

		if (!text) {
			return json({ error: 'Text is required' }, { status: 400 });
		}

		const voiceToUse = voice || 'en-IN-PrabhatNeural';
		
		// Convert speed (1.0 = normal) to rate format ("+0%" = normal)
		// speed 1.0 = +0%, speed 1.5 = +50%, speed 0.5 = -50%
		const ratePercentage = ((speed || 1.0) - 1) * 100;
		const rate = `${ratePercentage >= 0 ? '+' : ''}${Math.round(ratePercentage)}%`;

		// Generate unique request ID for error tracking
		const requestId = randomUUID();

		// Use edge-tts Python library directly
		const pythonScript = `
import edge_tts
import asyncio
import base64
import sys

async def main():
    try:
        communicate = edge_tts.Communicate(
            text="""${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}""",
            voice="${voiceToUse}",
            rate="${rate}"
        )
        
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        
        # Output base64 encoded audio
        print(base64.b64encode(audio_data).decode('utf-8'))
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
`;

		const audioBase64 = await new Promise<string>((resolve, reject) => {
			const python = spawn('python3', ['-c', pythonScript]);

			let stdout = '';
			let stderr = '';

			python.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			python.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			python.on('close', (code) => {
				if (code === 0 && stdout.trim()) {
					resolve(stdout.trim());
				} else {
					reject(
						new Error(
							`edge-tts failed (code ${code}): ${stderr || 'Unknown error'}`
						)
					);
				}
			});

			python.on('error', (error) => {
				reject(new Error(`Failed to spawn Python process: ${error.message}`));
			});

			// Set timeout to prevent hanging
			setTimeout(() => {
				python.kill();
				reject(new Error('TTS generation timeout after 30 seconds'));
			}, 30000);
		});

		return json({
			audio: audioBase64,
			contentType: 'audio/mp3' // edge-tts outputs MP3 by default
		});
	} catch (error) {
		console.error('TTS API error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'TTS generation failed'
			},
			{ status: 500 }
		);
	}
};
