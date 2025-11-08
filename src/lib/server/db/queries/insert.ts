// src/lib/server/db/queries/insert.ts
import { architects, projects, tasks, subtasks } from '$lib/server/db/schema';
import { db } from './db';

// Insert a new architect
export async function insertArchitect(data: { name: string }) {
  const result = await db
    .insert(architects)
    .values({
      name: data.name
    })
    .returning();

  return result[0];
}

// Insert a new project
export async function insertProject(data: {
  name: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status: string;
  priority: string;
}) {
  const result = await db
    .insert(projects)
    .values({
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      dueDate: data.dueDate,
      status: data.status,
      priority: data.priority
    })
    .returning();

  return result[0];
}

// Insert a new task
export async function insertTask(data: {
  name: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status: string;
  priority: string;
  projectId: string;
  architectId: string;
}) {
  const result = await db
    .insert(tasks)
    .values({
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      dueDate: data.dueDate,
      status: data.status,
      priority: data.priority,
      projectId: data.projectId,
      architectId: data.architectId
    })
    .returning();

  return result[0];
}

// Insert a new subtask
export async function insertSubtask(data: {
  name: string;
  description?: string | null;
  status: string;
  taskId: string;
}) {
  const result = await db
    .insert(subtasks)
    .values({
      name: data.name,
      description: data.description,
      status: data.status,
      taskId: data.taskId
    })
    .returning();

  return result[0];
}
