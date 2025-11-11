// src/lib/server/db/queries/selectPTS.ts
import { or, eq, isNull } from 'drizzle-orm';
import { architects, tasks, subtasks, projects } from '$lib/server/db/schema';

import { db } from '$lib/server/db/queries/db';

export async function selectPTS() {
	return await db
		.select({
			architectId: architects.id,
			architectName: architects.name,
			taskId: tasks.id,
			taskName: tasks.name,
			taskDescription: tasks.description,
			taskStartDate: tasks.startDate,
			taskDueDate: tasks.dueDate,
			taskStatus: tasks.status,
			taskPriority: tasks.priority,
			projectId: projects.id,
			projectName: projects.name,
			projectDescription: projects.description,
			projectStatus: projects.status,
			projectPriority: projects.priority,
			projectStartDate: projects.startDate,
			projectDueDate: projects.dueDate,
			subtaskId: subtasks.subtaskId,
			subtaskName: subtasks.name,
			subtaskDescription: subtasks.description,
			subtaskStatus: subtasks.status
		})
		.from(architects)
		// FULL JOIN tasks ON architects.architectId = tasks.architectId
		.fullJoin(tasks, eq(architects.id, tasks.architectId))
		// LEFT JOIN subtasks ON tasks.taskId = subtasks.taskId
		.leftJoin(subtasks, eq(tasks.id, subtasks.taskId))
		// RIGHT JOIN projects ON tasks.projectId = projects.projectId OR tasks.projectId = null
		.rightJoin(projects, or(eq(tasks.projectId, projects.id), isNull(tasks.projectId)));
}
