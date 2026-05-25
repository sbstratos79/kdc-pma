// src/routes/api/meta/+server.ts

import { json } from '@sveltejs/kit';
import { catchHandler } from '$lib/server/api-utils';
import { PRIORITIES, STATUSES } from '$lib/server/db/schema';

export function GET() {
	return catchHandler(async () => {
		return json({
			status: STATUSES,
			priority: PRIORITIES
		});
	}, 'Failed to fetch enums');
}
