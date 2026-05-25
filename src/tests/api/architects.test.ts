// src/tests/api/architects.test.ts
//
// Tests the GET / POST / PUT / DELETE handlers in
// src/routes/api/architects/+server.ts

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
	const { testDb } = await import('../helpers/test-db');
	return { db: testDb };
});

import { setupSchema, clearTables, closeDb } from '../helpers/test-db';
import { makeArchitect } from '../helpers/factories';
import { GET, POST, PUT, DELETE } from '../../routes/api/architects/+server';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());
afterAll(() => closeDb());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeURL(path: string) {
	return new URL(`http://localhost${path}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEvent(method: string, path: string, body?: unknown): any {
	const url = makeURL(path);
	const request = new Request(url.toString(), {
		method,
		headers: body ? { 'Content-Type': 'application/json' } : {},
		body: body ? JSON.stringify(body) : undefined
	});
	return { url, request, params: {}, route: { id: '' }, platform: undefined };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe('GET /api/architects', () => {
	it('returns { data: [] } when no architects exist', async () => {
		const res = await GET(makeEvent('GET', '/api/architects'));
		const json = await res.json();
		expect(json.data).toEqual([]);
	});

	it('returns all architects after inserts', async () => {
		await makeArchitect({ name: 'Alpha' });
		await makeArchitect({ name: 'Beta' });
		const res = await GET(makeEvent('GET', '/api/architects'));
		const json = await res.json();
		expect(json.data).toHaveLength(2);
	});

	it('returns a single architect when ?id= is supplied', async () => {
		const a = await makeArchitect({ name: 'Solo' });
		const res = await GET(makeEvent('GET', `/api/architects?id=${a.id}`));
		const json = await res.json();
		expect(json.data.architectName ?? json.data.name).toBe('Solo');
	});

	it('returns 404 when ?id= does not match any architect', async () => {
		const res = await GET(makeEvent('GET', '/api/architects?id=ghost'));
		expect(res.status).toBe(404);
		const json = await res.json();
		expect(json.error).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe('POST /api/architects', () => {
	it('creates an architect and returns 201 with the new record', async () => {
		const res = await POST(
			makeEvent('POST', '/api/architects', {
				name: 'New Architect',
				email: 'new@test.com'
			})
		);
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.data).toBeDefined();
		expect(json.data.architectName ?? json.data.name).toBe('New Architect');
	});

	it('returns 400 when architectName is missing', async () => {
		const res = await POST(
			makeEvent('POST', '/api/architects', {
				email: 'missing-name@test.com'
			})
		);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toMatch(/architectName/i);
	});
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------
describe('PUT /api/architects', () => {
	it('updates an architect and returns the updated record', async () => {
		const a = await makeArchitect({ name: 'Old' });
		const res = await PUT(
			makeEvent('PUT', '/api/architects', {
				id: a.id,
				data: { architectName: 'Renamed' }
			})
		);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.architectName ?? json.data.name).toBe('Renamed');
	});

	it('returns 404 when the architect does not exist', async () => {
		const res = await PUT(
			makeEvent('PUT', '/api/architects', {
				id: 'no-such-id',
				data: { architectName: 'Ghost' }
			})
		);
		expect(res.status).toBe(404);
	});

	it('returns 404 when body has no id (falls back to path segment)', async () => {
		// When body has no id, the handler falls back to the last URL path segment
		// ('architects'). It then tries to update an architect with that id,
		// finds none, and returns 404.
		const res = await PUT(
			makeEvent('PUT', '/api/architects', {
				data: { architectName: 'NoID' }
			})
		);
		expect(res.status).toBe(404);
	});
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/architects', () => {
	it('deletes an existing architect and returns success', async () => {
		const a = await makeArchitect();
		const res = await DELETE(makeEvent('DELETE', '/api/architects', { id: a.id }));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	it('returns 404 when the architect does not exist', async () => {
		const res = await DELETE(makeEvent('DELETE', '/api/architects', { id: 'ghost-id' }));
		expect(res.status).toBe(404);
	});
});
