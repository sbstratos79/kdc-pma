// src/tests/api/tasks.test.ts
//
// Tests the GET / POST / PUT / DELETE handlers in
// src/routes/api/tasks/+server.ts

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
	const { testDb } = await import('../helpers/test-db');
	return { db: testDb };
});

import { setupSchema, clearTables, closeDb } from '../helpers/test-db';
import { makeProject, makeArchitect, makeTask } from '../helpers/factories';
import { GET, POST, PUT, DELETE } from '../../routes/api/tasks/+server';

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
describe('GET /api/tasks', () => {
	it('returns { data: [] } when no tasks exist', async () => {
		const res = await GET(makeEvent('GET', '/api/tasks'));
		const json = await res.json();
		expect(json.data).toEqual([]);
	});

	it('returns all tasks after inserts', async () => {
		const proj = await makeProject();
		await makeTask(proj.id);
		await makeTask(proj.id);
		const res = await GET(makeEvent('GET', '/api/tasks'));
		const json = await res.json();
		expect(json.data).toHaveLength(2);
	});

	it('returns a single task when ?id= is supplied', async () => {
		const proj = await makeProject();
		const t = await makeTask(proj.id, { name: 'Unique Task' });
		const res = await GET(makeEvent('GET', `/api/tasks?id=${t.id}`));
		const json = await res.json();
		expect(json.data.taskName).toBe('Unique Task');
	});

	it('returns 404 when ?id= does not match any task', async () => {
		const res = await GET(makeEvent('GET', '/api/tasks?id=ghost'));
		expect(res.status).toBe(404);
		const json = await res.json();
		expect(json.error).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe('POST /api/tasks', () => {
	it('creates a task and returns 201 with the new record', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const res = await POST(
			makeEvent('POST', '/api/tasks', {
				name: 'New Task',
				projectId: proj.id,
				architectId: arch.id,
				status: 'In Progress',
				priority: 'High'
			})
		);
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.data).toBeDefined();
		expect(json.data.taskName ?? json.data.name).toBe('New Task');
	});

	it('returns 400 when taskName is missing', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const res = await POST(
			makeEvent('POST', '/api/tasks', {
				projectId: proj.id,
				architectId: arch.id
			})
		);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toMatch(/taskName/i);
	});

	it('returns 400 when projectId is missing', async () => {
		const arch = await makeArchitect();
		const res = await POST(
			makeEvent('POST', '/api/tasks', {
				taskName: 'No Project',
				architectId: arch.id
			})
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 when architectId is missing', async () => {
		const proj = await makeProject();
		const res = await POST(
			makeEvent('POST', '/api/tasks', {
				taskName: 'No Architect',
				projectId: proj.id
			})
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 when startDate is not a valid ISO date', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const res = await POST(
			makeEvent('POST', '/api/tasks', {
				taskName: 'Bad Date',
				projectId: proj.id,
				architectId: arch.id,
				startDate: 'not-a-date'
			})
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 when dueDate is not a valid ISO date', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const res = await POST(
			makeEvent('POST', '/api/tasks', {
				taskName: 'Bad Due',
				projectId: proj.id,
				architectId: arch.id,
				dueDate: 'yesterday'
			})
		);
		expect(res.status).toBe(400);
	});

	it('accepts alternative field names (taskName / taskStatus / taskPriority)', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const res = await POST(
			makeEvent('POST', '/api/tasks', {
				taskName: 'Alt Fields',
				projectId: proj.id,
				architectId: arch.id,
				taskStatus: 'On Hold',
				taskPriority: 'Low'
			})
		);
		expect(res.status).toBe(201);
	});
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------
describe('PUT /api/tasks', () => {
	it('updates a task and returns the updated record', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const t = await makeTask(proj.id, { architectId: arch.id, name: 'Old', status: 'Planning' });
		const res = await PUT(
			makeEvent('PUT', '/api/tasks', {
				id: t.id,
				data: { taskName: 'Updated', taskStatus: 'Completed', taskPriority: 'High' }
			})
		);
		expect(res.status).toBe(200);
		const json = await res.json();
		const record = json.data;
		expect(record.taskName ?? record.name).toBe('Updated');
		expect(record.taskStatus ?? record.status).toBe('Completed');
	});

	it('returns 404 when the task does not exist', async () => {
		const res = await PUT(
			makeEvent('PUT', '/api/tasks', {
				id: 'no-such-id',
				data: { taskName: 'Ghost' }
			})
		);
		expect(res.status).toBe(404);
	});

	it('returns 400 for an invalid taskStartDate', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const t = await makeTask(proj.id, { architectId: arch.id });
		const res = await PUT(
			makeEvent('PUT', '/api/tasks', {
				id: t.id,
				data: { taskStartDate: 'not-a-date' }
			})
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 for an invalid taskDueDate', async () => {
		const arch = await makeArchitect();
		const proj = await makeProject();
		const t = await makeTask(proj.id, { architectId: arch.id });
		const res = await PUT(
			makeEvent('PUT', '/api/tasks', {
				id: t.id,
				data: { taskDueDate: 'bad-date-format' }
			})
		);
		expect(res.status).toBe(400);
	});
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/tasks', () => {
	it('deletes an existing task and returns success', async () => {
		const proj = await makeProject();
		const t = await makeTask(proj.id);
		const res = await DELETE(makeEvent('DELETE', '/api/tasks', { id: t.id }));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	it('returns 404 when the task does not exist', async () => {
		const res = await DELETE(makeEvent('DELETE', '/api/tasks', { id: 'ghost-id' }));
		expect(res.status).toBe(404);
	});
});
