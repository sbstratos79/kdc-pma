import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
// Import your schema enums
import { priority, status } from '$lib/server/db/schema';

export const GET: RequestHandler = async () => {
  try {
    // Extract enum values from the schema
    const enums = {
      priority: priority.enumValues,
      status: status.enumValues
    };

    return json(enums);
  } catch (error) {
    console.error('Error fetching enums:', error);
    return json({ error: 'Failed to fetch enums' }, { status: 500 });
  }
};
