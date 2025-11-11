// src/routes/api/meta/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../enums/$types';
// Import your schema enums
import { PRIORITIES, STATUSES } from '$lib/server/db/schema';

export const GET: RequestHandler = async () => {
  try {
    // Extract enum values from the schema
    const enums = {
      status: STATUSES,
      priority: PRIORITIES
    };

    return json(enums);
  } catch (error) {
    console.error('Error fetching enums:', error);
    return json({ error: 'Failed to fetch enums' }, { status: 500 });
  }
};
