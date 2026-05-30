// src/routes/api/architects/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { catchHandler } from '$lib/server/api-utils';

import {
	createArchitect as repoCreateArchitect,
	getArchitects as repoGetArchitects,
	listArchitects as repoListArchitects,
	updateArchitect as repoUpdateArchitect,
	deleteArchitect
} from '$lib/server/db/repos/architect.repo';

export const GET: RequestHandler = ({ url }) => {
	return catchHandler(async () => {
		const id = url.searchParams.get('id');

		if (id) {
			const dto = await repoGetArchitects(id);
			if (!dto) {
				return json({ error: 'Architect not found' }, { status: 404 });
			}
			return json({ data: dto });
		}

		const architects = await repoListArchitects();
		return json({ data: architects });
	}, 'Failed to fetch architects');
};

export const POST: RequestHandler = ({ request }) => {
	return catchHandler(async () => {
		const body = await request.json();

		const architectId = crypto.randomUUID();

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
		return json({ data: dto ?? created }, { status: 201 });
	}, 'Failed to create architect');
};

export const PUT: RequestHandler = ({ request, url }) => {
	return catchHandler(async () => {
		const pathParts = new URL(url).pathname.split('/').filter(Boolean);
		const idFromPath = pathParts[pathParts.length - 1];
		const body = await request.json();
		const id = body.id ?? idFromPath ?? body.architectId;
		const data = body.data ?? body;

		if (!id || !data) {
			return json({ error: 'Missing id or data in request' }, { status: 400 });
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const changes: any = {};
		if ('architectName' in data) changes.name = (data.architectName || '').trim();

		const updated = await repoUpdateArchitect(String(id), changes);

		if (!updated) {
			return json({ error: 'Architect not found or not updated' }, { status: 404 });
		}

		const dto = await repoGetArchitects(updated.id);
		return json({ data: dto ?? updated });
	}, 'Failed to update architect');
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

		const deleted = await deleteArchitect(String(id));
		if (!deleted) {
			return json({ error: 'Architect not found or not deleted' }, { status: 404 });
		}

		return json({ success: true, data: deleted });
	}, 'Failed to delete architect');
};
