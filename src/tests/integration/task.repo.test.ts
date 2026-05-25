// src/tests/integration/task.repo.test.ts

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
  const { testDb } = await import('../helpers/test-db');
  return { db: testDb };
});

import { setupSchema, clearTables, testDb } from '../helpers/test-db';
import { makeArchitect, makeProject, makeTask } from '../helpers/factories';
import { tasks, architects } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  createTask,
  listTasks,
  getTasks,
  updateTask,
  deleteTaskCascade,
} from '$lib/server/db/repos/task.repo';
import { deleteArchitect } from '$lib/server/db/repos/architect.repo';
import { deleteProjectCascade } from '$lib/server/db/repos/project.repo';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());

describe('createTask', () => {
  it('creates a task linked to a project and architect', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    const result = await createTask({
      id: 'task-1', name: 'Foundation', status: 'Planning', priority: 'High',
      projectId: proj.id, architectId: arch.id,
    });
    expect(result!.id).toBe('task-1');
    expect(result!.projectId).toBe(proj.id);
    expect(result!.architectId).toBe(arch.id);
  });

  it('throws when the project does not exist', async () => {
    await expect(
      createTask({ id: 'task-x', name: 'Ghost', status: 'Planning', priority: 'Low',
        projectId: 'no-project', architectId: null })
    ).rejects.toThrow('Project not found');
  });

  it('throws when the architect does not exist', async () => {
    const proj = await makeProject();
    await expect(
      createTask({ id: 'task-y', name: 'Ghost', status: 'Planning', priority: 'Low',
        projectId: proj.id, architectId: 'no-architect' })
    ).rejects.toThrow('Architect not found');
  });

  it('accepts a null architectId', async () => {
    const proj = await makeProject();
    const result = await createTask({
      id: 'task-2', name: 'Unassigned', status: 'Planning', priority: 'Medium',
      projectId: proj.id, architectId: null,
    });
    expect(result!.architectId).toBeNull();
  });
});

describe('listTasks', () => {
  it('returns empty array when no tasks exist', async () => {
    expect(await listTasks()).toEqual([]);
  });

  it('returns all tasks when no projectId filter is supplied', async () => {
    const p1 = await makeProject();
    const p2 = await makeProject();
    await makeTask(p1.id);
    await makeTask(p1.id);
    await makeTask(p2.id);
    expect(await listTasks()).toHaveLength(3);
  });

  it('returns only tasks for the specified project', async () => {
    const p1 = await makeProject();
    const p2 = await makeProject();
    await makeTask(p1.id);
    await makeTask(p2.id);
    await makeTask(p2.id);
    const result = await listTasks(p2.id);
    expect(result).toHaveLength(2);
    expect(result.every(t => t.projectId === p2.id)).toBe(true);
  });
});

describe('getTasks', () => {
  it('returns the task by id', async () => {
    const proj = await makeProject();
    const t = await makeTask(proj.id, { name: 'Named Task' });
    expect((await getTasks(t.id))!.name).toBe('Named Task');
  });

  it('returns null for an unknown id', async () => {
    expect(await getTasks('no-such')).toBeNull();
  });
});

describe('updateTask', () => {
  it('persists changed fields', async () => {
    const proj = await makeProject();
    const t = await makeTask(proj.id, { status: 'Planning' });
    const updated = await updateTask(t.id, { status: 'In Progress', priority: 'High' });
    expect(updated!.status).toBe('In Progress');
    expect(updated!.priority).toBe('High');
  });

  it('returns null for an unknown id', async () => {
    expect(await updateTask('ghost', { status: 'Completed' })).toBeNull();
  });
});

describe('deleteTaskCascade', () => {
  it('removes the task and returns it', async () => {
    const proj = await makeProject();
    const t = await makeTask(proj.id);
    const deleted = await deleteTaskCascade(t.id);
    expect(deleted!.id).toBe(t.id);
    expect(await getTasks(t.id)).toBeNull();
  });

  it('returns null when the task does not exist', async () => {
    expect(await deleteTaskCascade('no-such-id')).toBeNull();
  });
});

describe('FK cascade behaviour', () => {
  it('sets architectId to NULL on task when that architect is deleted (ON DELETE SET NULL)', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    const t = await makeTask(proj.id, { architectId: arch.id });

    await deleteArchitect(arch.id);

    const [row] = await testDb.select().from(tasks).where(eq(tasks.id, t.id));
    expect(row.architectId).toBeNull();
  });

  it('deletes tasks when their parent project is deleted (ON DELETE CASCADE)', async () => {
    const proj = await makeProject();
    await makeTask(proj.id);
    await makeTask(proj.id);

    await deleteProjectCascade(proj.id);

    const remaining = await testDb.select().from(tasks).where(eq(tasks.projectId, proj.id));
    expect(remaining).toHaveLength(0);
  });
});
