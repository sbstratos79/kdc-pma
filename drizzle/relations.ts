import { relations } from "drizzle-orm/relations";
import { architects, tasks, projects, subtasks } from "./schema";

export const tasksRelations = relations(tasks, ({one, many}) => ({
	architect: one(architects, {
		fields: [tasks.architectId],
		references: [architects.architectId]
	}),
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.projectId]
	}),
	subtasks: many(subtasks),
}));

export const architectsRelations = relations(architects, ({many}) => ({
	tasks: many(tasks),
}));

export const projectsRelations = relations(projects, ({many}) => ({
	tasks: many(tasks),
}));

export const subtasksRelations = relations(subtasks, ({one}) => ({
	task: one(tasks, {
		fields: [subtasks.taskId],
		references: [tasks.taskId]
	}),
}));