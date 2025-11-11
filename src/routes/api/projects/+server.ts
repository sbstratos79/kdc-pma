// src/routes/api/projects/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Project } from '$lib/types';

import {
  createProject as repoCreateProject,
  getProjects as repoGetProjects,
  listProjects as repoListProjects,
  updateProject as repoUpdateProject,
  deleteProjectCascade
} from '$lib/server/db/repos/project.repo';

// Helper: validate ISO date strings
function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return true;
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

// Map repo DTO
function ensureProjectDto(p: any): Project {
  return {
    projectId: p.projectId ?? '',
    projectName: p.projectName ?? '',
    projectDescription: p.projectDescription ?? null,
    projectStartDate: p.projectStartDate ?? null,
    projectDueDate: p.projectDueDate ?? null,
    projectStatus: p.projectStatus ?? '',
    projectPriority: p.projectPriority ?? '',
    tasks: p.tasks ?? []
  };
}

// GET /api/projects or GET /api/projects?id=xxx
export const GET: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    // If id provided, fetch single project
    if (id) {
      const dto = await repoGetProjects(id);
      if (!dto) {
        return json({ error: 'Project not found' }, { status: 404 });
      }
      return json({ data: dto });
    }

    // Otherwise fetch all projects
    const raw = await repoListProjects();
    const projects: Project[] = [];
    for (const r of raw) {
      const dto = await repoGetProjects(r.id);
      if (dto) projects.push(dto);
    }
    return json({ data: projects });
  } catch (err) {
    console.error('GET /api/projects error', err);
    return json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
};

// POST /api/projects
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    // Accept either { name, ... } or your frontend Project-shaped fields
    const projectId =
      globalThis.crypto && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : String(Date.now()) + Math.random();

    const projectName = (body.name ?? body.projectName ?? '').trim();
    const startDate = body.startDate ?? body.projectStartDate ?? null;
    const dueDate = body.dueDate ?? body.projectDueDate ?? null;
    const status = body.status ?? body.projectStatus ?? 'Planning';
    const priority = body.priority ?? body.projectPriority ?? 'Medium';
    const description = body.description ?? body.projectDescription ?? null;

    if (!projectName) {
      return json({ error: 'projectName is required' }, { status: 400 });
    }
    if (!isValidDate(startDate) || !isValidDate(dueDate)) {
      return json(
        { error: 'Invalid date format (startDate/dueDate). Use ISO format' },
        { status: 400 }
      );
    }

    const created = await repoCreateProject({
      id: projectId,
      name: projectName,
      description,
      startDate,
      dueDate,
      status,
      priority
    });

    if (!created) {
      return json({ error: 'Failed to create project' }, { status: 500 });
    }

    const dto = await repoGetProjects(created.id);
    return json({ data: dto ?? ensureProjectDto(created) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects error', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};

// PUT /api/projects/:id
export const PUT: RequestHandler = async ({ request, url }) => {
  try {
    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
    const idFromPath = pathParts[pathParts.length - 1];
    const body = await request.json();
    const id = body.id ?? idFromPath ?? body.projectId;
    const data = body.data ?? body;

    if (!id || !data) {
      return json({ error: 'Missing id or data in request' }, { status: 400 });
    }

    const changes: any = {};
    if ('projectName' in data) changes.name = (data.projectName || '').trim();
    if ('projectDescription' in data) changes.description = data.projectDescription ?? null;
    if ('projectStartDate' in data) {
      if (!isValidDate(data.projectStartDate))
        return json({ error: 'Invalid projectStartDate' }, { status: 400 });
      changes.startDate = data.projectStartDate ?? null;
    }
    if ('projectDueDate' in data) {
      if (!isValidDate(data.projectDueDate))
        return json({ error: 'Invalid projectDueDate' }, { status: 400 });
      changes.dueDate = data.projectDueDate ?? null;
    }
    if ('projectStatus' in data) changes.status = data.projectStatus;
    if ('projectPriority' in data) changes.priority = data.projectPriority;

    const updated = await repoUpdateProject(String(id), changes);

    if (!updated) {
      return json({ error: 'Project not found or not updated' }, { status: 404 });
    }

    const dto = await repoGetProjects(updated.id);
    return json({ data: dto ?? ensureProjectDto(updated) });
  } catch (err) {
    console.error('PUT /api/projects error', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};

// DELETE /api/projects/:id
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

    const deleted = await deleteProjectCascade(String(id));
    if (!deleted) {
      return json({ error: 'Project not found or not deleted' }, { status: 404 });
    }

    return json({ success: true, data: deleted });
  } catch (err) {
    console.error('DELETE /api/projects error', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};
