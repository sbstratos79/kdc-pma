// $lib/db/schema.ts
import { sqliteTable, uniqueIndex, check, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const STATUSES = ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'] as const;
export const PRIORITIES = ['High', 'Medium', 'Low'] as const;

// convenience TS union types (optional)
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

// helper to build a SQL list like: 'Planning','In Progress',... (properly escaped)
function sqlListFromArray(arr: readonly string[]) {
	// build quoted, comma-separated string
	const quoted = arr.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
	return sql.raw(quoted); // raw fragment with the quoted list
}

export const architects = sqliteTable(
	'architects',
	{
		id: text('architect_id').primaryKey().notNull(),
		name: text().notNull(),
		email: text(),
		phoneNumber: integer('phone_number')
	},
	(table) => [
		uniqueIndex('architects_phone_number_unique').on(table.phoneNumber),
		uniqueIndex('architects_email_unique').on(table.email)
	]
);

export const projects = sqliteTable(
	'projects',
	{
		id: text('project_id').primaryKey().notNull(),
		name: text().notNull(),
		description: text(),
		startDate: text('start_date'),
		dueDate: text('due_date'),
		addedTime: text('added_time')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		status: text().notNull(),
		priority: text().notNull()
	},
	() => [
		check('projects_status_check', sql`status IN (${sqlListFromArray(STATUSES)})`),
		check('projects_priority_check', sql`priority IN (${sqlListFromArray(PRIORITIES)})`)
	]
);

export const tasks = sqliteTable(
	'tasks',
	{
		id: text('task_id').primaryKey().notNull(),
		name: text().notNull(),
		description: text(),
		startDate: text('start_date'),
		dueDate: text('due_date'),
		addedTime: text('added_time')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		status: text().notNull(),
		priority: text().notNull(),
		architectId: text('architect_id').references(() => architects.id, {
			onDelete: 'set null',
			onUpdate: 'cascade'
		}),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' })
	},
	() => [
		check('tasks_status_check', sql`status IN (${sqlListFromArray(STATUSES)})`),
		check('tasks_priority_check', sql`priority IN (${sqlListFromArray(PRIORITIES)})`)
	]
);
