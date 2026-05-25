// src/lib/server/db/repos/architect.repo.ts

import { architects, tasks as tasksTable, projects as projectsTable } from '$lib/server/db/schema';
import { db } from '$lib/server/db/queries/db';
import { eq, inArray } from 'drizzle-orm';
import { single } from './_helpers';

import type { Architect as ArchitectDTO, Task as TaskDTO } from '$lib/types';

export type ArchitectSelect = typeof architects.$inferSelect;
export type ArchitectInsert = typeof architects.$inferInsert;
export type ArchitectUpdate = Partial<ArchitectInsert>;

export async function createArchitect(input: ArchitectInsert): Promise<ArchitectSelect | null> {
	return single(db.insert(architects).values(input).returning());
}

export async function getArchitects(id: string): Promise<ArchitectSelect | null> {
	return single(db.select().from(architects).where(eq(architects.id, id)).limit(1));
}

export async function listArchitects(): Promise<ArchitectSelect[]> {
	return db.select().from(architects);
}

export async function updateArchitect(
	id: string,
	changes: ArchitectUpdate
): Promise<ArchitectSelect | null> {
	return single(db.update(architects).set(changes).where(eq(architects.id, id)).returning());
}

/** Delete architect */
export async function deleteArchitect(id: string): Promise<ArchitectSelect | null> {
	return single(db.delete(architects).where(eq(architects.id, id)).returning());
}

/** Get architect with their tasks (batched project queries, no N+1) */
export async function getArchitectWithTasks(id: string): Promise<ArchitectDTO | null> {
	const arch = await getArchitects(id);
	if (!arch) return null;

	const rawTasks = await db.select().from(tasksTable).where(eq(tasksTable.architectId, id));

	const projectIds = [...new Set(rawTasks.map((t) => t.projectId))];
	const projects = projectIds.length
		? await db.select().from(projectsTable).where(inArray(projectsTable.id, projectIds))
		: [];
	const projectMap = new Map(projects.map((p) => [p.id, p.name]));

	const tasks: TaskDTO[] = rawTasks.map((t) => ({
		architectId: arch.id,
		architectName: arch.name,
		taskId: t.id,
		taskName: t.name,
		taskDescription: t.description ?? null,
		taskStartDate: t.startDate ?? null,
		taskDueDate: t.dueDate ?? null,
		addedTime: t.addedTime ?? null,
		taskStatus: t.status,
		taskPriority: t.priority,
		projectId: t.projectId,
		projectName: projectMap.get(t.projectId) ?? ''
	}));

	return {
		architectId: arch.id,
		architectName: arch.name,
		tasks
	};
}
