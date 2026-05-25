// src/lib/server/db/repos/task.repo.ts

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
		db.select().from(projectsTable).where(eq(projectsTable.id, input.projectId)).limit(1)
	);
	if (!proj) throw new Error('Project not found');

	if (input.architectId) {
		const arch = await single(
			db.select().from(architectsTable).where(eq(architectsTable.id, input.architectId)).limit(1)
		);
		if (!arch) throw new Error('Architect not found');
	}

	return single(db.insert(tasks).values(input).returning());
}

export async function getTasks(id: string): Promise<TaskSelect | null> {
	return single(db.select().from(tasks).where(eq(tasks.id, id)).limit(1));
}

/** List tasks (optionally by project) */
export async function listTasks(projectId?: string): Promise<TaskSelect[]> {
	if (projectId) return db.select().from(tasks).where(eq(tasks.projectId, projectId));
	return db.select().from(tasks);
}

export async function updateTask(id: string, changes: TaskUpdate): Promise<TaskSelect | null> {
	return single(db.update(tasks).set(changes).where(eq(tasks.id, id)).returning());
}

/** Delete task */
export async function deleteTaskCascade(id: string): Promise<TaskSelect | null> {
	return db.transaction(async (tx) => {
		const deleted = await tx.delete(tasks).where(eq(tasks.id, id)).returning();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (deleted as any)[0] ?? null;
	});
}

/** Get task with architect and project names (single LEFT JOIN query) */
export async function getTask(id: string): Promise<TaskDTO | null> {
	const [row] = await db
		.select()
		.from(tasks)
		.leftJoin(architectsTable, eq(tasks.architectId, architectsTable.id))
		.leftJoin(projectsTable, eq(tasks.projectId, projectsTable.id))
		.where(eq(tasks.id, id))
		.limit(1);

	if (!row) return null;

	const { tasks: t, architects: arch, projects: proj } = row;

	return {
		architectId: t.architectId,
		architectName: arch?.name ?? 'Unassigned',
		taskId: t.id,
		taskName: t.name,
		taskDescription: t.description ?? null,
		taskStartDate: t.startDate ?? null,
		taskDueDate: t.dueDate ?? null,
		taskStatus: t.status,
		addedTime: t.addedTime ?? null,
		taskPriority: t.priority,
		projectId: t.projectId,
		projectName: proj?.name ?? ''
	};
}

/** List tasks with architect and project names (single LEFT JOIN query, no N+1) */
export async function listTasksWithDetails(projectId?: string): Promise<TaskDTO[]> {
	const query = projectId
		? db
				.select()
				.from(tasks)
				.leftJoin(architectsTable, eq(tasks.architectId, architectsTable.id))
				.leftJoin(projectsTable, eq(tasks.projectId, projectsTable.id))
				.where(eq(tasks.projectId, projectId))
		: db
				.select()
				.from(tasks)
				.leftJoin(architectsTable, eq(tasks.architectId, architectsTable.id))
				.leftJoin(projectsTable, eq(tasks.projectId, projectsTable.id));

	const rows = await query;

	return rows.map(({ tasks: t, architects: arch, projects: proj }) => ({
		architectId: t.architectId,
		architectName: arch?.name ?? 'Unassigned',
		taskId: t.id,
		taskName: t.name,
		taskDescription: t.description ?? null,
		taskStartDate: t.startDate ?? null,
		taskDueDate: t.dueDate ?? null,
		taskStatus: t.status,
		addedTime: t.addedTime ?? null,
		taskPriority: t.priority,
		projectId: t.projectId,
		projectName: proj?.name ?? ''
	}));
}
