// src/lib/server/db/repos/project.repo.ts

import {
	projects,
	tasks as tasksTable,
	architects as architectsTable
} from '$lib/server/db/schema';
import { db } from '$lib/server/db/queries/db';
import { eq, inArray } from 'drizzle-orm';
import { single } from './_helpers';

import type { Project as ProjectDTO, Task as TaskDTO } from '$lib/types';

export type ProjectSelect = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type ProjectUpdate = Partial<ProjectInsert>;

export async function createProject(input: ProjectInsert): Promise<ProjectSelect | null> {
	return single(db.insert(projects).values(input).returning());
}

export async function getProjects(id: string): Promise<ProjectSelect | null> {
	return single(db.select().from(projects).where(eq(projects.id, id)).limit(1));
}

export async function listProjects(): Promise<ProjectSelect[]> {
	return db.select().from(projects);
}

export async function updateProject(
	id: string,
	changes: ProjectUpdate
): Promise<ProjectSelect | null> {
	return single(db.update(projects).set(changes).where(eq(projects.id, id)).returning());
}

/** Delete project and cascade to tasks */
export async function deleteProjectCascade(id: string): Promise<ProjectSelect | null> {
	return db.transaction(async (tx) => {
		const deleted = await tx.delete(projects).where(eq(projects.id, id)).returning();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (deleted as any)[0] ?? null;
	});
}

/** Get project with tasks and architect names (batched architect queries, no N+1) */
export async function getProjectWithTasks(id: string): Promise<ProjectDTO | null> {
	const proj = await getProjects(id);
	if (!proj) return null;

	const rawTasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));

	const architectIds = [...new Set(rawTasks.map((t) => t.architectId).filter(Boolean))];
	const architectList = architectIds.length
		? await db.select().from(architectsTable).where(inArray(architectsTable.id, architectIds))
		: [];
	const architectMap = new Map(architectList.map((a) => [a.id, a.name]));

	const tasks: TaskDTO[] = rawTasks.map((t) => ({
		architectId: t.architectId,
		architectName: t.architectId ? (architectMap.get(t.architectId) ?? 'Unassigned') : 'Unassigned',
		taskId: t.id,
		taskName: t.name,
		taskDescription: t.description ?? null,
		taskStartDate: t.startDate ?? null,
		taskDueDate: t.dueDate ?? null,
		addedTime: t.addedTime ?? null,
		taskStatus: t.status,
		taskPriority: t.priority,
		projectId: proj.id,
		projectName: proj.name
	}));

	return {
		projectId: proj.id,
		projectName: proj.name,
		projectDescription: proj.description ?? null,
		projectStartDate: proj.startDate ?? null,
		addedTime: proj.addedTime ?? null,
		projectDueDate: proj.dueDate ?? null,
		projectStatus: proj.status,
		projectPriority: proj.priority,
		tasks
	};
}
