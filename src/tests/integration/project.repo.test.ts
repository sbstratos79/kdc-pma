// src/tests/integration/project.repo.test.ts

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
	const { testDb } = await import('../helpers/test-db');
	return { db: testDb };
});

import { setupSchema, clearTables, testDb } from '../helpers/test-db';
import { makeArchitect, makeProject, makeTask } from '../helpers/factories';
import { tasks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	createProject,
	listProjects,
	getProjects,
	updateProject,
	deleteProjectCascade,
	getProjectWithTasks
} from '$lib/server/db/repos/project.repo';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());

describe('createProject', () => {
	it('inserts a record and returns it', async () => {
		const result = await createProject({
			id: 'proj-1',
			name: 'HQ Tower',
			status: 'Planning',
			priority: 'High'
		});
		expect(result!.id).toBe('proj-1');
		expect(result!.name).toBe('HQ Tower');
	});

	it('stores optional fields when provided', async () => {
		const result = await createProject({
			id: 'proj-2',
			name: 'Bridge',
			status: 'In Progress',
			priority: 'Medium',
			description: 'A big bridge',
			startDate: '2025-01-01',
			dueDate: '2025-12-31'
		});
		expect(result!.description).toBe('A big bridge');
		expect(result!.startDate).toBe('2025-01-01');
	});

	it('rejects an invalid status value (check constraint)', async () => {
		await expect(
			createProject({ id: 'proj-3', name: 'Bad', status: 'Unknown', priority: 'High' })
		).rejects.toThrow();
	});

	it('rejects an invalid priority value (check constraint)', async () => {
		await expect(
			createProject({ id: 'proj-4', name: 'Bad', status: 'Planning', priority: 'Critical' })
		).rejects.toThrow();
	});
});

describe('listProjects', () => {
	it('returns empty array when no projects exist', async () => {
		expect(await listProjects()).toEqual([]);
	});

	it('returns all projects', async () => {
		await makeProject();
		await makeProject();
		expect(await listProjects()).toHaveLength(2);
	});
});

describe('getProjects', () => {
	it('returns the matching project by id', async () => {
		const p = await makeProject({ name: 'Sky Walk' });
		const result = await getProjects(p.id);
		expect(result!.name).toBe('Sky Walk');
	});

	it('returns null for an unknown id', async () => {
		expect(await getProjects('ghost-id')).toBeNull();
	});
});

describe('updateProject', () => {
	it('persists changed fields and leaves others intact', async () => {
		const p = await makeProject({ name: 'Old Name', status: 'Planning', priority: 'Low' });
		const updated = await updateProject(p.id, { name: 'New Name', status: 'In Progress' });
		expect(updated!.name).toBe('New Name');
		expect(updated!.status).toBe('In Progress');
		expect(updated!.priority).toBe('Low'); // unchanged
	});

	it('returns null for an unknown id', async () => {
		expect(await updateProject('no-such', { name: 'Ghost' })).toBeNull();
	});
});

describe('deleteProjectCascade', () => {
	it('removes the project and returns it', async () => {
		const p = await makeProject();
		const deleted = await deleteProjectCascade(p.id);
		expect(deleted!.id).toBe(p.id);
		expect(await getProjects(p.id)).toBeNull();
	});

	it('cascades deletion to child tasks', async () => {
		const p = await makeProject();
		await makeTask(p.id);
		await makeTask(p.id);
		await deleteProjectCascade(p.id);
		const remaining = await testDb.select().from(tasks).where(eq(tasks.projectId, p.id));
		expect(remaining).toHaveLength(0);
	});

	it('returns null when the project does not exist', async () => {
		expect(await deleteProjectCascade('no-such-id')).toBeNull();
	});
});

describe('getProjectWithTasks (DTO builder)', () => {
	it('returns null for an unknown id', async () => {
		expect(await getProjectWithTasks('no-such')).toBeNull();
	});

	it('shapes the DTO with tasks and architect names', async () => {
		const arch = await makeArchitect({ name: 'Bob' });
		const proj = await makeProject({ name: 'Tower', description: 'Tall building' });
		await makeTask(proj.id, { architectId: arch.id, name: 'Foundation', priority: 'High' });
		await makeTask(proj.id, { architectId: null, name: 'Cleanup', priority: 'Low' });

		const dto = await getProjectWithTasks(proj.id);
		expect(dto).not.toBeNull();
		expect(dto!.projectName).toBe('Tower');
		expect(dto!.projectDescription).toBe('Tall building');
		expect(dto!.tasks).toHaveLength(2);

		const found = dto!.tasks.find((t) => t.taskName === 'Foundation')!;
		expect(found.architectName).toBe('Bob');
		expect(found.taskPriority).toBe('High');
	});

	it('returns empty tasks array when project has no tasks', async () => {
		const proj = await makeProject({ name: 'Empty' });
		const dto = await getProjectWithTasks(proj.id);
		expect(dto!.tasks).toEqual([]);
	});
});
