// src/routes/api/tasks/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Task } from '$lib/types';

import {
	createTask as repoCreateTask,
	getTasks as repoGetTasks,
	listTasks as repoListTasks,
	updateTask as repoUpdateTask,
	deleteTaskCascade
} from '$lib/server/db/repos/task.repo';

// Helper: validate ISO date strings (simple)
function isValidDate(dateString: string | null | undefined): boolean {
	if (!dateString) return true; // treat empty as okay (optional)
	const d = new Date(dateString);
	return !isNaN(d.getTime());
}

// Map repo DTO (already shaped by getTask) passthrough
function ensureTaskDto(t: any): Task {
	// Minimal normalization – your getTask returns correct shape already
	return {
		architectId: t.architectId ?? '',
		architectName: t.architectName ?? '',
		taskId: t.taskId ?? '',
		taskName: t.taskName ?? '',
		taskDescription: t.taskDescription ?? null,
		taskStartDate: t.taskStartDate ?? null,
		taskDueDate: t.taskDueDate ?? null,
		taskStatus: t.taskStatus ?? '',
		taskPriority: t.taskPriority ?? '',
		projectId: t.projectId ?? '',
		projectName: t.projectName ?? ''
	};
}

// GET /api/tasks or GET /api/tasks?id=xxx
export const GET: RequestHandler = async ({ url }) => {
	try {
		const id = url.searchParams.get('id');

		// If id provided, fetch single task
		if (id) {
			const dto = await repoGetTasks(id);
			if (!dto) {
				return json({ error: 'Task not found' }, { status: 404 });
			}
			return json({ data: dto });
		}

		// Otherwise fetch all tasks
		const raw = await repoListTasks(); // returns TaskSelect[] (rows)
		// For performance you may want to implement a single joined query; for now do per-task DTO mapping
		const tasks: Task[] = [];
		for (const r of raw) {
			const dto = await repoGetTasks(r.id);
			if (dto) tasks.push(dto);
		}
		return json({ data: tasks });
	} catch (err) {
		console.error('GET /api/tasks error', err);
		return json({ error: 'Failed to fetch tasks' }, { status: 500 });
	}
};

// POST /api/tasks
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		// Accept either { name, ... } or your frontend Task-shaped fields
		const taskId =
			globalThis.crypto && (crypto as any).randomUUID
				? (crypto as any).randomUUID()
				: String(Date.now()) + Math.random();

		const taskName = (body.name ?? body.taskName ?? '').trim();
		const projectId = body.projectId ?? body.project_id ?? null;
		const architectId = body.architectId ?? body.architect_id ?? null;
		const startDate = body.startDate ?? body.taskStartDate ?? null;
		const dueDate = body.dueDate ?? body.taskDueDate ?? null;
		const status = body.status ?? body.taskStatus ?? 'Planning';
		const priority = body.priority ?? body.taskPriority ?? 'Medium';
		const description = body.description ?? body.taskDescription ?? null;

		if (!taskName || !projectId || !architectId) {
			return json({ error: 'taskName, projectId and architectId are required' }, { status: 400 });
		}
		if (!isValidDate(startDate) || !isValidDate(dueDate)) {
			return json(
				{ error: 'Invalid date format (startDate/dueDate). Use ISO format' },
				{ status: 400 }
			);
		}

		const created = await repoCreateTask({
			id: taskId,
			name: taskName,
			description,
			startDate,
			dueDate,
			status,
			priority,
			projectId: String(projectId),
			architectId: String(architectId)
		});

		if (!created) {
			return json({ error: 'Failed to create task' }, { status: 500 });
		}

		// Return full DTO
		const dto = await repoGetTasks(created.id);
		return json({ data: dto ?? ensureTaskDto(created) }, { status: 201 });
	} catch (err) {
		console.error('POST /api/tasks error', err);
		return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
};

// PUT /api/tasks/:id
export const PUT: RequestHandler = async ({ request, params, url }) => {
	// SvelteKit uses route params if file is +server.ts in [id] route; since this file is +server.ts in /api/tasks,
	// the TaskGrid makes PUT to /api/tasks/:id – but this handler receives the raw request.
	// If you prefer param routes, create file src/routes/api/tasks/[id]/+server.ts instead.
	try {
		// Try to read id from URL path last segment if present
		const pathParts = new URL(url).pathname.split('/').filter(Boolean);
		const idFromPath = pathParts[pathParts.length - 1];
		const body = await request.json();
		const id = body.id ?? idFromPath ?? body.taskId;
		const data = body.data ?? body;

		if (!id || !data) {
			return json({ error: 'Missing id or data in request' }, { status: 400 });
		}

		const changes: any = {};
		if ('taskName' in data) changes.name = (data.taskName || '').trim();
		if ('taskDescription' in data) changes.description = data.taskDescription ?? null;
		if ('taskStartDate' in data) {
			if (!isValidDate(data.taskStartDate))
				return json({ error: 'Invalid taskStartDate' }, { status: 400 });
			changes.startDate = data.taskStartDate ?? null;
		}
		if ('taskDueDate' in data) {
			if (!isValidDate(data.taskDueDate))
				return json({ error: 'Invalid taskDueDate' }, { status: 400 });
			changes.dueDate = data.taskDueDate ?? null;
		}
		if ('taskStatus' in data) changes.status = data.taskStatus;
		if ('taskPriority' in data) changes.priority = data.taskPriority;
		if ('projectId' in data) changes.projectId = String(data.projectId);
		if ('architectId' in data) changes.architectId = String(data.architectId);

		const updated = await repoUpdateTask(String(id), changes);

		if (!updated) {
			return json({ error: 'Task not found or not updated' }, { status: 404 });
		}

		const dto = await repoGetTasks(updated.id);
		return json({ data: dto ?? ensureTaskDto(updated) });
	} catch (err) {
		console.error('PUT /api/tasks error', err);
		return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
};

// DELETE /api/tasks/:id
export const DELETE: RequestHandler = async ({ request, url }) => {
	try {
		// Accept either body { id } or last path segment as id
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

		const deleted = await deleteTaskCascade(String(id));
		if (!deleted) {
			return json({ error: 'Task not found or not deleted' }, { status: 404 });
		}

		return json({ success: true, data: deleted });
	} catch (err) {
		console.error('DELETE /api/tasks error', err);
		return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
};
