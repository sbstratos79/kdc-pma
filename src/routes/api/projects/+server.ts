// src/routes/api/projects/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { catchHandler, isValidDate } from '$lib/server/api-utils';

import {
	createProject as repoCreateProject,
	getProjects as repoGetProjects,
	listProjects as repoListProjects,
	updateProject as repoUpdateProject,
	deleteProjectCascade
} from '$lib/server/db/repos/project.repo';

export const GET: RequestHandler = ({ url }) => {
	return catchHandler(async () => {
		const id = url.searchParams.get('id');

		if (id) {
			const dto = await repoGetProjects(id);
			if (!dto) {
				return json({ error: 'Project not found' }, { status: 404 });
			}
			return json({ data: dto });
		}

		const projects = await repoListProjects();
		return json({ data: projects });
	}, 'Failed to fetch projects');
};

export const POST: RequestHandler = ({ request }) => {
	return catchHandler(async () => {
		const body = await request.json();

		const projectId = crypto.randomUUID();

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
		return json({ data: dto ?? created }, { status: 201 });
	}, 'Failed to create project');
};

export const PUT: RequestHandler = ({ request, url }) => {
	return catchHandler(async () => {
		const pathParts = new URL(url).pathname.split('/').filter(Boolean);
		const idFromPath = pathParts[pathParts.length - 1];
		const body = await request.json();
		const id = body.id ?? idFromPath ?? body.projectId;
		const data = body.data ?? body;

		if (!id || !data) {
			return json({ error: 'Missing id or data in request' }, { status: 400 });
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
		return json({ data: dto ?? updated });
	}, 'Failed to update project');
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

		const deleted = await deleteProjectCascade(String(id));
		if (!deleted) {
			return json({ error: 'Project not found or not deleted' }, { status: 404 });
		}

		return json({ success: true, data: deleted });
	}, 'Failed to delete project');
};
