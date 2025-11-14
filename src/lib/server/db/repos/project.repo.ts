import {
	projects,
	tasks as tasksTable,
	architects as architectsTable
} from '$lib/server/db/schema';
import { db } from '$lib/server/db/queries/db';
import { eq } from 'drizzle-orm';
import { single } from './_helpers';

import type { Project as ProjectDTO, Task as TaskDTO } from '$lib/types';

export type ProjectSelect = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type ProjectUpdate = Partial<ProjectInsert>;

/** Create a project */
export async function createProject(input: ProjectInsert): Promise<ProjectSelect | null> {
	return single(db.insert(projects).values(input).returning());
}

/** Get raw project by id */
export async function getProjects(id: string): Promise<ProjectSelect | null> {
	return single(db.select().from(projects).where(eq(projects.id, id)).limit(1));
}

/** List projects */
export async function listProjects(): Promise<ProjectSelect[]> {
	return db.select().from(projects);
}

/** Update project */
export async function updateProject(
	id: string,
	changes: ProjectUpdate
): Promise<ProjectSelect | null> {
	return single(db.update(projects).set(changes).where(eq(projects.id, id)).returning());
}

/** Delete project and cascade to tasks (transactional hard delete) */
export async function deleteProjectCascade(id: string): Promise<ProjectSelect | null> {
	return db.transaction(async (tx) => {
		const deleted = await tx.delete(projects).where(eq(projects.id, id)).returning();
		return (deleted as any)[0] ?? null;
	});
}

/** Convenience: get project + tasks + architect names shaped to frontend types */
export async function getProjectWithTasks(id: string): Promise<ProjectDTO | null> {
	const proj = await getProjects(id);
	if (!proj) return null;

	// load tasks
	const rawTasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));

	const tasks: TaskDTO[] = [];
	for (const t of rawTasks) {
		// fetch architect name
		const arch = await single(
			db.select().from(architectsTable).where(eq(architectsTable.id, t.architectId)).limit(1)
		);

		tasks.push({
			architectId: t.architectId,
			architectName: arch?.name ?? '',
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
		});
	}

	const dto: ProjectDTO = {
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

	return dto;
}
