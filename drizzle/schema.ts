import { pgTable, uuid, text, bigint, foreignKey, date, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const priority = pgEnum("Priority", ['High', 'Medium', 'Low'])
export const status = pgEnum("Status", ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'])


export const architects = pgTable("architects", {
	architectId: uuid("architect_id").defaultRandom().primaryKey().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name"),
	email: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	phoneNumber: bigint("phone_number", { mode: "number" }),
});

export const tasks = pgTable("tasks", {
	name: text().notNull(),
	description: text(),
	startDate: date("start_date"),
	dueDate: date("due_date"),
	status: status(),
	priority: priority(),
	architectId: uuid("architect_id"),
	projectId: uuid("project_id"),
	taskId: uuid("task_id").defaultRandom().primaryKey().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.architectId],
			foreignColumns: [architects.architectId],
			name: "tasks_architect_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.projectId],
			name: "tasks_project_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const projects = pgTable("projects", {
	projectId: uuid("project_id").defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	startDate: date("start_date"),
	dueDate: date("due_date"),
	status: status(),
	priority: priority(),
}, (table) => [
	unique("Projects_Name_key").on(table.name),
]);

export const subtasks = pgTable("subtasks", {
	subtaskId: uuid("subtask_id").defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	status: status(),
	taskId: uuid("task_id"),
}, (table) => [
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.taskId],
			name: "subtasks_task_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);
