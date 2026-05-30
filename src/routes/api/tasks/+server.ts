// src/routes/api/tasks/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { catchHandler, isValidDate } from '$lib/server/api-utils';

import {
	createTask as repoCreateTask,
	getTask as repoGetTask,
	listTasksWithDetails as repoListTasksWithDetails,
	updateTask as repoUpdateTask,
	deleteTaskCascade
} from '$lib/server/db/repos/task.repo';

export const GET: RequestHandler = ({ url }) => {
	return catchHandler(async () => {
		const id = url.searchParams.get('id');

		if (id) {
			const dto = await repoGetTask(id);
			if (!dto) {
				return json({ error: 'Task not found' }, { status: 404 });
			}
			return json({ data: dto });
		}

		const tasks = await repoListTasksWithDetails();
		return json({ data: tasks });
	}, 'Failed to fetch tasks');
};

export const POST: RequestHandler = ({ request }) => {
	return catchHandler(async () => {
		const body = await request.json();
		const taskId = crypto.randomUUID();

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
		return json({ data: dto ?? created }, { status: 201 });
	}, 'Failed to create task');
};

export const PUT: RequestHandler = ({ request, url }) => {
	return catchHandler(async () => {
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
		return json({ data: dto ?? updated });
	}, 'Failed to update task');
};

export const DELETE: RequestHandler = ({ request, url }) => {
	return catchHandler(async () => {
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
	}, 'Failed to delete task');
};
