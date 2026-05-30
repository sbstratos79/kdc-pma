// src/tests/api/hooks-auth.test.ts
//
// Tests the API authentication middleware in src/hooks.server.ts.

import { vi, describe, it, expect } from 'vitest';

import { handle } from '../../hooks.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEvent(method: string, path: string, authenticated = false): any {
	const cookies = {
		get: vi.fn(() => (authenticated ? '1' : undefined)),
		set: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn()
	};
	const url = new URL(`http://localhost${path}`);
	const request = new Request(url.toString(), { method });
	return { url, request, cookies, locals: {} };
}

async function callHandle(method: string, path: string, authenticated = false) {
	const event = makeEvent(method, path, authenticated);
	const resolve = vi.fn(() => new Response('ok', { status: 200 }));
	const response = await handle({ event, resolve });
	return { response, event, resolve };
}

// ---------------------------------------------------------------------------
// Unauthenticated — mutation methods blocked
// ---------------------------------------------------------------------------
describe('unauthenticated requests', () => {
	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
		'blocks %s /api/projects with 401',
		async (method) => {
			const { response, resolve } = await callHandle(method, '/api/projects');
			expect(response.status).toBe(401);
			const json = await response.json();
			expect(json.error).toBe('Unauthorized');
			expect(resolve).not.toHaveBeenCalled();
		}
	);

	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
		'blocks %s /api/architects with 401',
		async (method) => {
			const { response, resolve } = await callHandle(method, '/api/architects');
			expect(response.status).toBe(401);
			expect(resolve).not.toHaveBeenCalled();
		}
	);

	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
		'blocks %s /api/tasks with 401',
		async (method) => {
			const { response, resolve } = await callHandle(method, '/api/tasks');
			expect(response.status).toBe(401);
			expect(resolve).not.toHaveBeenCalled();
		}
	);

	it('blocks POST to nested /api/projects/123', async () => {
		const { response, resolve } = await callHandle('POST', '/api/projects/123');
		expect(response.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('blocks POST to /api/architects/ with trailing slash', async () => {
		const { response, resolve } = await callHandle('POST', '/api/architects/');
		expect(response.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('allows GET /api/projects (read-only)', async () => {
		const { response, resolve } = await callHandle('GET', '/api/projects');
		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('allows POST /api/auth/login (not a protected endpoint)', async () => {
		const { response, resolve } = await callHandle('POST', '/api/auth/login');
		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('allows GET /api/reports', async () => {
		const { response, resolve } = await callHandle('GET', '/api/reports');
		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// Authenticated — all methods pass through
// ---------------------------------------------------------------------------
describe('authenticated requests', () => {
	it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
		'passes through %s /api/projects',
		async (method) => {
			const { response, resolve } = await callHandle(method, '/api/projects', true);
			expect(response.status).toBe(200);
			expect(resolve).toHaveBeenCalledOnce();
		}
	);

	it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
		'passes through %s /api/architects',
		async (method) => {
			const { response, resolve } = await callHandle(method, '/api/architects', true);
			expect(response.status).toBe(200);
			expect(resolve).toHaveBeenCalledOnce();
		}
	);

	it('sets locals.authenticated to true when auth cookie is present', async () => {
		const { event, resolve } = await callHandle('GET', '/api/projects', true);
		expect(event.locals.authenticated).toBe(true);
		expect(resolve).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
	it('does not block POST to /api/projects-extra (different path)', async () => {
		const { response, resolve } = await callHandle('POST', '/api/projects-extra');
		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('sets locals.authenticated to false when no auth cookie', async () => {
		const { event } = await callHandle('GET', '/api/projects');
		expect(event.locals.authenticated).toBe(false);
	});
});
