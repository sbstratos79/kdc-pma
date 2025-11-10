import { sqliteTable, uniqueIndex, check, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const architects = sqliteTable(
	'architects',
	{
		architectId: text('architect_id').primaryKey().notNull(),
		name: text().notNull(),
		email: text(),
		phoneNumber: integer('phone_number')
	},
	(table) => [
		uniqueIndex('architects_phone_number_unique').on(table.phoneNumber),
		uniqueIndex('architects_email_unique').on(table.email),
		check(
			'projects_check_1',
			sql`status IN ('Planning','In Progress','Completed','On Hold','Cancelled'`
		),
		check('projects_check_2', sql`priority IN ('High','Medium','Low'`),
		check(
			'tasks_check_3',
			sql`status IN ('Planning','In Progress','Completed','On Hold','Cancelled'`
		),
		check('tasks_check_4', sql`priority IN ('High','Medium','Low'`)
	]
);

export const projects = sqliteTable(
	'projects',
	{
		projectId: text('project_id').primaryKey().notNull(),
		name: text().notNull(),
		description: text(),
		startDate: text('start_date'),
		dueDate: text('due_date'),
		status: text().notNull(),
		priority: text().notNull()
	},
	() => [
		check(
			'projects_check_1',
			sql`status IN ('Planning','In Progress','Completed','On Hold','Cancelled'`
		),
		check('projects_check_2', sql`priority IN ('High','Medium','Low'`),
		check(
			'tasks_check_3',
			sql`status IN ('Planning','In Progress','Completed','On Hold','Cancelled'`
		),
		check('tasks_check_4', sql`priority IN ('High','Medium','Low'`)
	]
);

export const tasks = sqliteTable(
	'tasks',
	{
		taskId: text('task_id').primaryKey().notNull(),
		name: text().notNull(),
		description: text(),
		startDate: text('start_date'),
		dueDate: text('due_date'),
		status: text().notNull(),
		priority: text().notNull(),
		architectId: text('architect_id')
			.notNull()
			.references(() => architects.architectId, { onDelete: 'set null', onUpdate: 'cascade' }),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.projectId, { onDelete: 'cascade', onUpdate: 'cascade' })
	},
	() => [
		check(
			'projects_check_1',
			sql`status IN ('Planning','In Progress','Completed','On Hold','Cancelled'`
		),
		check('projects_check_2', sql`priority IN ('High','Medium','Low'`),
		check(
			'tasks_check_3',
			sql`status IN ('Planning','In Progress','Completed','On Hold','Cancelled'`
		),
		check('tasks_check_4', sql`priority IN ('High','Medium','Low'`)
	]
);
