// src/routes/api/tasks/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Task } from '$lib/types';

import {
	createTask as repoCreateTask,
	getTask as repoGetTask,
	listTasks as repoListTasks,
	updateTask as repoUpdateTask,
	deleteTaskCascade
} from '$lib/server/db/repos/task.repo';

function isValidDate(dateString: string | null | undefined): boolean {
	if (!dateString) return true; // treat empty as okay (optional)
	const d = new Date(dateString);
	return !isNaN(d.getTime());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureTaskDto(t: any): Task {
	return {
		architectId: t.architectId ?? null,
		architectName: t.architectName ?? '',
		taskId: t.id ?? t.taskId ?? '',
		taskName: t.name ?? t.taskName ?? '',
		taskDescription: t.description ?? t.taskDescription ?? null,
		taskStartDate: t.startDate ?? t.taskStartDate ?? null,
		addedTime: t.addedTime ?? null,
		taskDueDate: t.dueDate ?? t.taskDueDate ?? null,
		taskStatus: t.status ?? t.taskStatus ?? '',
		taskPriority: t.priority ?? t.taskPriority ?? '',
		projectId: t.projectId ?? '',
		projectName: t.projectName ?? ''
	};
}

// GET /api/tasks or GET /api/tasks?id=xxx
export const GET: RequestHandler = async ({ url }) => {
	try {
		const id = url.searchParams.get('id');

		if (id) {
			const dto = await repoGetTask(id);
			if (!dto) {
				return json({ error: 'Task not found' }, { status: 404 });
			}
			return json({ data: dto });
		}

		const raw = await repoListTasks();
		const tasks: Task[] = [];
		for (const r of raw) {
			const dto = await repoGetTask(r.id);
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
		// Accept either { name, ... } or frontend Task-shaped fields
		const taskId =
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			globalThis.crypto && (crypto as any).randomUUID
				? // eslint-disable-next-line @typescript-eslint/no-explicit-any
					(crypto as any).randomUUID()
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

		const dto = await repoGetTask(created.id);
		return json({ data: dto ?? ensureTaskDto(created) }, { status: 201 });
	} catch (err) {
		console.error('POST /api/tasks error', err);
		return json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
};

// PUT /api/tasks/:id
export const PUT: RequestHandler = async ({ request, url }) => {
	// Single-file handler for PUT /api/tasks/:id — reads id from URL path or body
	try {
		const pathParts = new URL(url).pathname.split('/').filter(Boolean);
		const idFromPath = pathParts[pathParts.length - 1];
		const body = await request.json();
		const id = body.id ?? idFromPath ?? body.taskId;
		const data = body.data ?? body;

		if (!id || !data) {
			return json({ error: 'Missing id or data in request' }, { status: 400 });
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
		if ('projectId' in data) changes.projectId = data.projectId;
		if ('architectId' in data) changes.architectId = data.architectId;

		const updated = await repoUpdateTask(String(id), changes);

		if (!updated) {
			return json({ error: 'Task not found or not updated' }, { status: 404 });
		}

		const dto = await repoGetTask(updated.id);
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
