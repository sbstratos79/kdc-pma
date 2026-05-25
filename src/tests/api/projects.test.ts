// src/tests/api/projects.test.ts
//
// Tests the GET / POST / PUT / DELETE handlers in
// src/routes/api/projects/+server.ts by calling them directly with
// constructed Request / URL objects.

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
  const { testDb } = await import('../helpers/test-db');
  return { db: testDb };
});

import { setupSchema, clearTables, closeDb } from '../helpers/test-db';
import { makeProject } from '../helpers/factories';
import { GET, POST, PUT, DELETE } from '../../routes/api/projects/+server';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());
afterAll(() => closeDb());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeURL(path: string) {
  return new URL(`http://localhost${path}`);
}

function makeEvent(method: string, path: string, body?: unknown): any {
  const url = makeURL(path);
  const request = new Request(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { url, request, params: {}, route: { id: '' }, platform: undefined };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe('GET /api/projects', () => {
  it('returns { data: [] } when no projects exist', async () => {
    const res = await GET(makeEvent('GET', '/api/projects'));
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('returns all projects after inserts', async () => {
    await makeProject({ name: 'Alpha' });
    await makeProject({ name: 'Beta' });
    const res = await GET(makeEvent('GET', '/api/projects'));
    const json = await res.json();
    expect(json.data).toHaveLength(2);
  });

  it('returns a single project when ?id= is supplied', async () => {
    const p = await makeProject({ name: 'Solo' });
    const res = await GET(makeEvent('GET', `/api/projects?id=${p.id}`));
    const json = await res.json();
    expect(json.data.projectId ?? json.data.id).toBe(p.id);
  });

  it('returns 404 when ?id= does not match any project', async () => {
    const res = await GET(makeEvent('GET', '/api/projects?id=ghost'));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe('POST /api/projects', () => {
  it('creates a project and returns 201 with the new record', async () => {
    const res = await POST(makeEvent('POST', '/api/projects', {
      projectName: 'New Tower', projectStatus: 'Planning', projectPriority: 'High',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toBeDefined();
  });

  it('returns 400 when projectName is missing', async () => {
    const res = await POST(makeEvent('POST', '/api/projects', {
      projectStatus: 'Planning', projectPriority: 'Medium',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/projectName/i);
  });

  it('returns 400 when startDate is not a valid ISO date', async () => {
    const res = await POST(makeEvent('POST', '/api/projects', {
      projectName: 'Bad Dates', projectStatus: 'Planning', projectPriority: 'Low',
      startDate: 'not-a-date',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when dueDate is not a valid ISO date', async () => {
    const res = await POST(makeEvent('POST', '/api/projects', {
      projectName: 'Bad Due', projectStatus: 'Planning', projectPriority: 'Low',
      dueDate: 'yesterday',
    }));
    expect(res.status).toBe(400);
  });

  it('accepts the alternative field names (name / status / priority)', async () => {
    const res = await POST(makeEvent('POST', '/api/projects', {
      name: 'Alt Fields', status: 'On Hold', priority: 'Low',
    }));
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------
describe('PUT /api/projects', () => {
  it('updates a project and returns the updated record', async () => {
    const p = await makeProject({ name: 'Old' });
    const res = await PUT(makeEvent('PUT', '/api/projects', {
      id: p.id,
      data: { projectName: 'New', projectStatus: 'Completed', projectPriority: 'High' },
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    // The route returns the raw DB shape or the DTO — either way check the name
    const record = json.data;
    expect(record.projectName ?? record.name).toBe('New');
  });

  it('returns 404 when the project does not exist', async () => {
    const res = await PUT(makeEvent('PUT', '/api/projects', {
      id: 'no-such-id',
      data: { projectName: 'Ghost' },
    }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid projectStartDate', async () => {
    const p = await makeProject();
    const res = await PUT(makeEvent('PUT', '/api/projects', {
      id: p.id,
      data: { projectStartDate: 'not-a-date' },
    }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/projects', () => {
  it('deletes an existing project and returns success', async () => {
    const p = await makeProject();
    const res = await DELETE(makeEvent('DELETE', '/api/projects', { id: p.id }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 404 when the project does not exist', async () => {
    const res = await DELETE(makeEvent('DELETE', '/api/projects', { id: 'ghost-id' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when no matching project id can be found', async () => {
    // When body has no id, the handler falls back to the last URL path segment
    // ('projects'). It then tries to delete a project with that id, finds none,
    // and returns 404. A true 400 is unreachable via a /api/projects URL because
    // the path always yields a non-null fallback string.
    const res = await DELETE(makeEvent('DELETE', '/api/projects', {}));
    expect(res.status).toBe(404);
  });
});
