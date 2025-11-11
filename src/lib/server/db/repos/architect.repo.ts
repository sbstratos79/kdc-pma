import { architects } from '$lib/server/db/schema';
import { db } from '$lib/server/db/queries/db';
import { eq } from 'drizzle-orm';
import { single } from './_helpers';

import type { Architect as ArchitectDTO, Task as TaskDTO } from '$lib/types';

export type ArchitectSelect = typeof architects.$inferSelect;
export type ArchitectInsert = typeof architects.$inferInsert;
export type ArchitectUpdate = Partial<ArchitectInsert>;

/** Create architect */
export async function createArchitect(input: ArchitectInsert): Promise<ArchitectSelect | null> {
	return single(db.insert(architects).values(input).returning());
}

/** Get architect by id (raw DB shape) */
export async function getArchitects(id: string): Promise<ArchitectSelect | null> {
	return single(db.select().from(architects).where(eq(architects.id, id)).limit(1));
}

/** List all architects */
export async function listArchitects(): Promise<ArchitectSelect[]> {
	return db.select().from(architects);
}

/** Update architect */
export async function updateArchitect(
	id: string,
	changes: ArchitectUpdate
): Promise<ArchitectSelect | null> {
	return single(db.update(architects).set(changes).where(eq(architects.id, id)).returning());
}

/** Delete architect (hard delete). If you want cascade or different behaviour, modify here. */
export async function deleteArchitect(id: string): Promise<ArchitectSelect | null> {
	return single(db.delete(architects).where(eq(architects.id, id)).returning());
}

/** Convenience: fetch architect with their tasks (DTO-shaped for frontend) */
export async function getArchitectWithTasks(id: string): Promise<ArchitectDTO | null> {
	const arch = await getArchitects(id);
	if (!arch) return null;

	// tasks table referenced lazily to avoid circular imports in some configs
	const { tasks: tasksTable, projects: projectsTable } = await import('$lib/server/db/schema');

	const rawTasks = await db.select().from(tasksTable).where(eq(tasksTable.architectId, id));

	const tasks: TaskDTO[] = [];
	for (const t of rawTasks) {
		// fetch project name for each task (small N; you can optimize with joins if needed)
		const proj = await single(
			db.select().from(projectsTable).where(eq(projectsTable.id, t.projectId)).limit(1)
		);
		tasks.push({
			architectId: arch.id,
			architectName: arch.name,
			taskId: t.id,
			taskName: t.name,
			taskDescription: t.description ?? null,
			taskStartDate: t.startDate ?? null,
			taskDueDate: t.dueDate ?? null,
			taskStatus: t.status,
			taskPriority: t.priority,
			projectId: t.projectId,
			projectName: proj?.name ?? ''
		});
	}

	return {
		architectId: arch.id,
		architectName: arch.name
		// tasks
	};
}
