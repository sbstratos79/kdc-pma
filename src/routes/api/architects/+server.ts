// src/routes/api/architects/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Architect } from '$lib/types';

import {
  createArchitect as repoCreateArchitect,
  getArchitects as repoGetArchitects,
  listArchitects as repoListArchitects,
  updateArchitect as repoUpdateArchitect,
  deleteArchitect
} from '$lib/server/db/repos/architect.repo';

// Map repo DTO
function ensureArchitectDto(a: any): Architect {
  return {
    architectId: a.architectId ?? '',
    architectName: a.architectName ?? ''
    // tasks: a.tasks ?? []
  };
}

// GET /api/architects or GET /api/architects?id=xxx
export const GET: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    // If id provided, fetch single architect
    if (id) {
      const dto = await repoGetArchitects(id);
      if (!dto) {
        return json({ error: 'Architect not found' }, { status: 404 });
      }
      return json({ data: dto });
    }

    // Otherwise fetch all architects
    const raw = await repoListArchitects();
    const architects: Architect[] = [];
    for (const r of raw) {
      const dto = await repoGetArchitects(r.id);
      if (dto) architects.push(dto);
    }
    return json({ data: architects });
  } catch (err) {
    console.error('GET /api/architects error', err);
    return json({ error: 'Failed to fetch architects' }, { status: 500 });
  }
};

// POST /api/architects
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    // Accept either { name, ... } or your frontend Architect-shaped fields
    const architectId =
      globalThis.crypto && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : String(Date.now()) + Math.random();

    const architectName = (body.name ?? body.architectName ?? '').trim();

    if (!architectName) {
      return json({ error: 'architectName is required' }, { status: 400 });
    }

    const created = await repoCreateArchitect({
      id: architectId,
      name: architectName
    });

    if (!created) {
      return json({ error: 'Failed to create architect' }, { status: 500 });
    }

    const dto = await repoGetArchitects(created.id);
    return json({ data: dto ?? ensureArchitectDto(created) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/architects error', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};

// PUT /api/architects/:id
export const PUT: RequestHandler = async ({ request, url }) => {
  try {
    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
    const idFromPath = pathParts[pathParts.length - 1];
    const body = await request.json();
    const id = body.id ?? idFromPath ?? body.architectId;
    const data = body.data ?? body;

    if (!id || !data) {
      return json({ error: 'Missing id or data in request' }, { status: 400 });
    }

    const changes: any = {};
    if ('architectName' in data) changes.name = (data.architectName || '').trim();

    const updated = await repoUpdateArchitect(String(id), changes);

    if (!updated) {
      return json({ error: 'Architect not found or not updated' }, { status: 404 });
    }

    const dto = await repoGetArchitects(updated.id);
    return json({ data: dto ?? ensureArchitectDto(updated) });
  } catch (err) {
    console.error('PUT /api/architects error', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};

// DELETE /api/architects/:id
export const DELETE: RequestHandler = async ({ request, url }) => {
  try {
    let id: string | null = null;
    try {
      const body = await request.json().catch(() => null);
      if (body && body.id) id = String(body.id);
    } catch {
      // ignore
    }
    if (!id) {
      const pathParts = new URL(url).pathname.split('/').filter(Boolean);
      id = pathParts[pathParts.length - 1] ?? null;
    }
    if (!id) {
      return json({ error: 'Missing id for delete' }, { status: 400 });
    }

    const deleted = await deleteArchitect(String(id));
    if (!deleted) {
      return json({ error: 'Architect not found or not deleted' }, { status: 404 });
    }

    return json({ success: true, data: deleted });
  } catch (err) {
    console.error('DELETE /api/architects error', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};
