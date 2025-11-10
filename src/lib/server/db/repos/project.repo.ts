import {
	projects,
	tasks as tasksTable,
	subtasks as subtasksTable,
	architects as architectsTable
} from '$lib/server/db/schema';
import { db } from '$lib/server/db/queries/db';
import { eq } from 'drizzle-orm';
import { single } from './_helpers';

import type { Project as ProjectDTO, Task as TaskDTO, Subtask as SubtaskDTO } from '$lib/types';

export type ProjectSelect = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type ProjectUpdate = Partial<ProjectInsert>;

/** Create a project */
export async function createProject(input: ProjectInsert): Promise<ProjectSelect | null> {
	return single(db.insert(projects).values(input).returning());
}

/** Get raw project by id */
export async function getProjectById(id: string): Promise<ProjectSelect | null> {
	return single(db.select().from(projects).where(eq(projects.projectId, id)).limit(1));
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
	return single(db.update(projects).set(changes).where(eq(projects.projectId, id)).returning());
}

/** Delete project and cascade to tasks & subtasks (transactional hard delete) */
export async function deleteProjectCascade(id: string): Promise<ProjectSelect | null> {
	return db.transaction(async (tx) => {
		// delete subtasks with task.projectId -> subtasks join by taskId
		// simpler: delete subtasks by joining tasks -> subtasks not available directly here, so:
		const projectTasks = await tx.select().from(tasksTable).where(eq(tasksTable.projectId, id));
		const taskIds = projectTasks.map((t) => t.taskId);

		if (taskIds.length > 0) {
			await tx.delete(subtasksTable).where((s) => s.taskId.in(taskIds));
			await tx.delete(tasksTable).where((t) => t.taskId.in(taskIds));
		}

		const deleted = await tx.delete(projects).where(eq(projects.projectId, id)).returning();
		return (deleted as any)[0] ?? null;
	});
}

/** Convenience: get project + tasks + subtasks + architect names shaped to frontend types */
export async function getProjectWithTasks(id: string): Promise<ProjectDTO | null> {
	const proj = await getProjectById(id);
	if (!proj) return null;

	// load tasks
	const rawTasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));

	const tasks: TaskDTO[] = [];
	for (const t of rawTasks) {
		// fetch architect name
		const arch = await single(
			db
				.select()
				.from(architectsTable)
				.where(eq(architectsTable.architectId, t.architectId))
				.limit(1)
		);
		// fetch subtasks
		const rawSubtasks = await db
			.select()
			.from(subtasksTable)
			.where(eq(subtasksTable.taskId, t.taskId));

		const subtasks: SubtaskDTO[] = (rawSubtasks as any[]).map((s) => ({
			subtaskId: s.subtaskId,
			subtaskName: s.name,
			subtaskDescription: s.description ?? null,
			subtaskStatus: s.status,
			taskId: s.taskId,
			taskName: t.name
		}));

		tasks.push({
			architectId: t.architectId,
			architectName: arch?.name ?? '',
			taskId: t.taskId,
			taskName: t.name,
			taskDescription: t.description ?? null,
			taskStartDate: t.startDate ?? null,
			taskDueDate: t.dueDate ?? null,
			taskStatus: t.status,
			taskPriority: t.priority,
			projectId: proj.projectId,
			projectName: proj.name,
			subtasks
		});
	}

	const dto: ProjectDTO = {
		projectId: proj.projectId,
		projectName: proj.name,
		projectDescription: proj.description ?? null,
		projectStartDate: proj.startDate ?? null,
		projectDueDate: proj.dueDate ?? null,
		projectStatus: proj.status,
		projectPriority: proj.priority,
		tasks
	};

	return dto;
}
