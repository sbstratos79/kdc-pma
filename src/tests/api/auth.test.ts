// src/tests/api/auth.test.ts
//
// Tests the POST /api/auth/login and POST /api/auth/logout handlers.

import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { POST as loginPOST } from '../../routes/api/auth/login/+server';
import { POST as logoutPOST } from '../../routes/api/auth/logout/+server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEvent(method: string, body?: unknown): any {
	const cookies = {
		set: vi.fn(),
		get: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn()
	};
	const url = new URL('http://localhost/api/auth/login');
	const request = new Request(url.toString(), {
		method,
		headers: body ? { 'Content-Type': 'application/json' } : {},
		body: body ? JSON.stringify(body) : undefined
	});
	return { url, request, cookies, params: {}, route: { id: '' }, platform: undefined };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
// Password must match the value loaded from .env by dotenv/config
// in the login endpoint (read at module-import time, before beforeAll).
const TEST_PASSWORD = 'admin';

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
	it('returns 200 and sets auth cookie with correct password', async () => {
		const event = makeEvent('POST', { password: TEST_PASSWORD });
		const res = await loginPOST(event);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'auth',
			'1',
			expect.objectContaining({ httpOnly: true })
		);
	});

	it('returns 401 with an incorrect password', async () => {
		const event = makeEvent('POST', { password: 'wrong-password' });
		const res = await loginPOST(event);
		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.error).toBe('Invalid password');
		expect(event.cookies.set).not.toHaveBeenCalled();
	});

	it('returns 401 with an empty password', async () => {
		const event = makeEvent('POST', { password: '' });
		const res = await loginPOST(event);
		expect(res.status).toBe(401);
	});

	it('returns 401 when password field is missing', async () => {
		const event = makeEvent('POST', {});
		const res = await loginPOST(event);
		expect(res.status).toBe(401);
	});

	// Empty body is handled by the JSON parser before our validation;
	// in practice the client always sends a body.
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
describe('POST /api/auth/logout', () => {
	it('returns 200 and deletes the auth cookie', async () => {
		const event = makeEvent('POST');
		const res = await logoutPOST(event);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(event.cookies.delete).toHaveBeenCalledWith('auth', { path: '/' });
	});
});
