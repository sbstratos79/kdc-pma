import { relations } from 'drizzle-orm/relations';
import { projects, tasks, architects } from './schema';

export const tasksRelations = relations(tasks, ({ one }) => ({
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	architect: one(architects, {
		fields: [tasks.architectId],
		references: [architects.id]
	})
}));

export const projectsRelations = relations(projects, ({ many }) => ({
	tasks: many(tasks)
}));

export const architectsRelations = relations(architects, ({ many }) => ({
	tasks: many(tasks)
}));
