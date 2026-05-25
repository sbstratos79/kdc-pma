// src/tests/helpers/factories.ts
//
// Lightweight test-data factories.
// Insert directly via testDb (bypassing repo validation) for speed and control.

import { testDb } from './test-db';
import { architects, projects, tasks } from '$lib/server/db/schema';

// Simple counter — unique within a process (each file gets its own process).
let _n = 0;
const uid = () => `id-${String(++_n).padStart(4, '0')}`;

// ---------------------------------------------------------------------------
// Date helpers — exported so tests can build consistent date strings.
// ---------------------------------------------------------------------------
export const TODAY     = new Date().toISOString().split('T')[0];
export const YESTERDAY = new Date(Date.now() -     86_400_000).toISOString().split('T')[0];
export const TOMORROW  = new Date(Date.now() +     86_400_000).toISOString().split('T')[0];
export const LAST_WEEK = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];
export const NEXT_WEEK = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];

/**
 * Same formula used in reports.repo.ts — lets tests compute the *expected*
 * daysOverdue value without hard-coding numbers that shift with timezones.
 */
export function expectedDaysOverdue(dueDateIso: string): number {
  const due = new Date(dueDateIso).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.floor((now - due) / 86_400_000);
}

/** Return an ISO date string N days before today. */
export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export async function makeArchitect(
  overrides: Partial<typeof architects.$inferInsert> = {}
) {
  const id = uid();
  const rows = await testDb
    .insert(architects)
    .values({ id, name: `Architect ${id}`, email: `arch-${id}@test.com`, ...overrides })
    .returning();
  return rows[0];
}

export async function makeProject(
  overrides: Partial<typeof projects.$inferInsert> = {}
) {
  const id = uid();
  const rows = await testDb
    .insert(projects)
    .values({ id, name: `Project ${id}`, status: 'Planning', priority: 'Medium', ...overrides })
    .returning();
  return rows[0];
}

export async function makeTask(
  projectId: string,
  overrides: Partial<typeof tasks.$inferInsert> = {}
) {
  const id = uid();
  const rows = await testDb
    .insert(tasks)
    .values({ id, name: `Task ${id}`, status: 'Planning', priority: 'Medium', projectId, ...overrides })
    .returning();
  return rows[0];
}
