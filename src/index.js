"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.result = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var schema_1 = require("../drizzle/schema");
var db_1 = require("./lib/server/db/db");
var queryProjectsTasksSubtasks = db_1.db
    .select({
    architectId: schema_1.architects.architectId,
    firstName: schema_1.architects.firstName,
    lastName: schema_1.architects.lastName,
    taskId: schema_1.tasks.taskId,
    taskName: schema_1.tasks.name,
    description: schema_1.tasks.description,
    startDate: schema_1.tasks.startDate,
    dueDate: schema_1.tasks.dueDate,
    taskStatus: schema_1.tasks.status,
    taskPriority: schema_1.tasks.priority,
    projectId: schema_1.projects.projectId,
    projectName: schema_1.projects.name,
    projectStatus: schema_1.projects.status,
    projectPriority: schema_1.projects.priority,
    projectStartDate: schema_1.projects.startDate,
    projectDueDate: schema_1.projects.dueDate,
    subtaskId: schema_1.subtasks.subtaskId,
    subtaskName: schema_1.subtasks.name,
    subtaskDescription: schema_1.subtasks.description,
    subtaskStatus: schema_1.subtasks.status
})
    .from(schema_1.projects)
    // LEFT JOIN tasks ON projects.projectId = tasks.projectId
    .leftJoin(schema_1.tasks, (0, drizzle_orm_1.eq)(schema_1.projects.projectId, schema_1.tasks.projectId))
    // LEFT JOIN architects ON tasks.architectId = architects.architectId
    .innerJoin(schema_1.architects, (0, drizzle_orm_1.eq)(schema_1.tasks.architectId, schema_1.architects.architectId))
    // LEFT JOIN subtasks ON tasks.taskId = subtasks.taskId
    .leftJoin(schema_1.subtasks, (0, drizzle_orm_1.eq)(schema_1.tasks.taskId, schema_1.subtasks.taskId));
exports.result = await queryProjectsTasksSubtasks;
console.log(exports.result);
