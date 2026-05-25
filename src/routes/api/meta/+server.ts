// src/routes/api/meta/+server.ts

import { json } from '@sveltejs/kit';
import { PRIORITIES, STATUSES } from '$lib/server/db/schema';

export async function GET() {
	try {
		const enums = {
			status: STATUSES,
			priority: PRIORITIES
		};

		return json(enums);
	} catch (error) {
		console.error('Error fetching enums:', error);
		return json({ error: 'Failed to fetch enums' }, { status: 500 });
	}
}
