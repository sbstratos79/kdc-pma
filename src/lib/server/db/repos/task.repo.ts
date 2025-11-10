import {
	tasks,
	projects as projectsTable,
	architects as architectsTable
} from '$lib/server/db/schema';
import { db } from '$lib/server/db/queries/db';
import { eq } from 'drizzle-orm';
import { single } from './_helpers';

import type { Task as TaskDTO } from '$lib/types';

export type TaskSelect = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type TaskUpdate = Partial<TaskInsert>;

/** Create task; checks existence of project and architect for friendlier errors */
export async function createTask(input: TaskInsert): Promise<TaskSelect | null> {
	const proj = await single(
		db.select().from(projectsTable).where(eq(projectsTable.projectId, input.projectId)).limit(1)
	);
	if (!proj) throw new Error('Project not found');

	const arch = await single(
		db
			.select()
			.from(architectsTable)
			.where(eq(architectsTable.architectId, input.architectId))
			.limit(1)
	);
	if (!arch) throw new Error('Architect not found');

	return single(db.insert(tasks).values(input).returning());
}

/** Get raw task */
export async function getTaskById(id: string): Promise<TaskSelect | null> {
	return single(db.select().from(tasks).where(eq(tasks.taskId, id)).limit(1));
}

/** List tasks (optionally by project) */
export async function listTasks(projectId?: string): Promise<TaskSelect[]> {
	if (projectId) return db.select().from(tasks).where(eq(tasks.projectId, projectId));
	return db.select().from(tasks);
}

/** Update task */
export async function updateTask(id: string, changes: TaskUpdate): Promise<TaskSelect | null> {
	return single(db.update(tasks).set(changes).where(eq(tasks.taskId, id)).returning());
}

/** Delete task (transactional hard delete) */
export async function deleteTaskCascade(id: string): Promise<TaskSelect | null> {
	return db.transaction(async (tx) => {
		const deleted = await tx.delete(tasks).where(eq(tasks.taskId, id)).returning();
		return (deleted as any)[0] ?? null;
	});
}

/** Convenience: get task and architect/project names shaped to frontend DTO */
export async function getTask(id: string): Promise<TaskDTO | null> {
	const t = await getTaskById(id);
	if (!t) return null;

	const arch = await single(
		db.select().from(architectsTable).where(eq(architectsTable.architectId, t.architectId)).limit(1)
	);
	const proj = await single(
		db.select().from(projectsTable).where(eq(projectsTable.projectId, t.projectId)).limit(1)
	);

	const dto: TaskDTO = {
		architectId: t.architectId,
		architectName: arch?.name ?? '',
		taskId: t.taskId,
		taskName: t.name,
		taskDescription: t.description ?? null,
		taskStartDate: t.startDate ?? null,
		taskDueDate: t.dueDate ?? null,
		taskStatus: t.status,
		taskPriority: t.priority,
		projectId: t.projectId,
		projectName: proj?.name ?? ''
	};

	return dto;
}
