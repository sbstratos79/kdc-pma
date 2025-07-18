"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subtasks = exports.projects = exports.tasks = exports.architects = exports.status = exports.priority = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
exports.priority = (0, pg_core_1.pgEnum)("Priority", ['High', 'Medium', 'Low']);
exports.status = (0, pg_core_1.pgEnum)("Status", ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled']);
exports.architects = (0, pg_core_1.pgTable)("architects", {
    architectId: (0, pg_core_1.uuid)("architect_id").defaultRandom().primaryKey().notNull(),
    firstName: (0, pg_core_1.text)("first_name").notNull(),
    lastName: (0, pg_core_1.text)("last_name"),
    email: (0, pg_core_1.text)(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    phoneNumber: (0, pg_core_1.bigint)("phone_number", { mode: "number" }),
});
exports.tasks = (0, pg_core_1.pgTable)("tasks", {
    name: (0, pg_core_1.text)().notNull(),
    description: (0, pg_core_1.text)(),
    startDate: (0, pg_core_1.date)("start_date"),
    dueDate: (0, pg_core_1.date)("due_date"),
    status: (0, exports.status)(),
    priority: (0, exports.priority)(),
    architectId: (0, pg_core_1.uuid)("architect_id"),
    projectId: (0, pg_core_1.uuid)("project_id"),
    taskId: (0, pg_core_1.uuid)("task_id").defaultRandom().primaryKey().notNull(),
}, function (table) { return [
    (0, pg_core_1.foreignKey)({
        columns: [table.architectId],
        foreignColumns: [exports.architects.architectId],
        name: "tasks_architect_id_fkey"
    }).onUpdate("cascade").onDelete("set null"),
    (0, pg_core_1.foreignKey)({
        columns: [table.projectId],
        foreignColumns: [exports.projects.projectId],
        name: "tasks_project_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
]; });
exports.projects = (0, pg_core_1.pgTable)("projects", {
    projectId: (0, pg_core_1.uuid)("project_id").defaultRandom().primaryKey().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    description: (0, pg_core_1.text)(),
    startDate: (0, pg_core_1.date)("start_date"),
    dueDate: (0, pg_core_1.date)("due_date"),
    status: (0, exports.status)(),
    priority: (0, exports.priority)(),
}, function (table) { return [
    (0, pg_core_1.unique)("Projects_Name_key").on(table.name),
]; });
exports.subtasks = (0, pg_core_1.pgTable)("subtasks", {
    subtaskId: (0, pg_core_1.uuid)("subtask_id").defaultRandom().primaryKey().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    description: (0, pg_core_1.text)(),
    status: (0, exports.status)(),
    taskId: (0, pg_core_1.uuid)("task_id"),
}, function (table) { return [
    (0, pg_core_1.foreignKey)({
        columns: [table.taskId],
        foreignColumns: [exports.tasks.taskId],
        name: "subtasks_task_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
]; });
