import { or, eq, isNull } from 'drizzle-orm';
import { architects, tasks, subtasks, projects } from '../drizzle/schema';

import { db } from '$db/dbConnection';

const queryProjectsTasksSubtasks = db
	.select({
		architectId: architects.architectId,
		firstName: architects.firstName,
		lastName: architects.lastName,
		taskId: tasks.taskId,
		taskName: tasks.name,
		description: tasks.description,
		startDate: tasks.startDate,
		dueDate: tasks.dueDate,
		taskStatus: tasks.status,
		taskPriority: tasks.priority,
		projectId: projects.projectId,
		projectName: projects.name,
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
	// LEFT JOIN tasks ON projects.projectId = tasks.projectId
	.fullJoin(tasks, eq(architects.architectId, tasks.architectId))
	// LEFT JOIN architects ON tasks.architectId = architects.architectId
	.leftJoin(subtasks, eq(tasks.taskId, subtasks.taskId))
	// LEFT JOIN subtasks ON tasks.taskId = subtasks.taskId
	.rightJoin(projects, or(eq(tasks.projectId, projects.projectId), isNull(tasks.projectId)));

export const result = await queryProjectsTasksSubtasks;
