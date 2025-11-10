import { subtasks } from '$lib/server/db/schema';
import { db } from '$lib/server/db/queries/db';
import { eq } from 'drizzle-orm';
import { single } from './_helpers';

import type { Subtask as SubtaskDTO } from '$lib/types';

export type SubtaskSelect = typeof subtasks.$inferSelect;
export type SubtaskInsert = typeof subtasks.$inferInsert;
export type SubtaskUpdate = Partial<SubtaskInsert>;

/** Create subtask */
export async function createSubtask(input: SubtaskInsert): Promise<SubtaskSelect | null> {
	return single(db.insert(subtasks).values(input).returning());
}

/** Get subtask */
export async function getSubtaskById(id: string): Promise<SubtaskSelect | null> {
	return single(db.select().from(subtasks).where(eq(subtasks.subtaskId, id)).limit(1));
}

/** List subtasks by task */
export async function listSubtasksByTask(taskId: string): Promise<SubtaskSelect[]> {
	return db.select().from(subtasks).where(eq(subtasks.taskId, taskId));
}

/** Update subtask */
export async function updateSubtask(
	id: string,
	changes: SubtaskUpdate
): Promise<SubtaskSelect | null> {
	return single(db.update(subtasks).set(changes).where(eq(subtasks.subtaskId, id)).returning());
}

/** Delete subtask */
export async function deleteSubtask(id: string): Promise<SubtaskSelect | null> {
	return single(db.delete(subtasks).where(eq(subtasks.subtaskId, id)).returning());
}

/** DTO convenience (if you need the frontend DTO instead of DB row) */
export async function getSubtaskDtoById(id: string): Promise<SubtaskDTO | null> {
	const s = await getSubtaskById(id);
	if (!s) return null;
	return {
		subtaskId: s.subtaskId,
		subtaskName: s.name,
		subtaskDescription: s.description ?? null,
		subtaskStatus: s.status,
		taskId: s.taskId,
		taskName: '' // caller can fetch task name or use getTaskWithSubtasks
	};
}
