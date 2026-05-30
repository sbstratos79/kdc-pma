import 'dotenv/config';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { password } = await request.json();

	if (!password || password !== LOGIN_PASSWORD) {
		return json({ error: 'Invalid password' }, { status: 401 });
	}

	cookies.set('auth', '1', {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    secure: false
	});

	return json({ success: true });
};
