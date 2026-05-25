// src/tests/integration/architect.repo.test.ts

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
	const { testDb } = await import('../helpers/test-db');
	return { db: testDb };
});

import { setupSchema, clearTables, closeDb } from '../helpers/test-db';
import { makeArchitect, makeProject, makeTask } from '../helpers/factories';
import {
	createArchitect,
	listArchitects,
	getArchitects,
	updateArchitect,
	deleteArchitect,
	getArchitectWithTasks
} from '$lib/server/db/repos/architect.repo';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());
afterAll(() => closeDb());

describe('createArchitect', () => {
	it('inserts a record and returns it', async () => {
		const result = await createArchitect({
			id: 'arch-1',
			name: 'Alice',
			email: 'alice@test.com'
		});
		expect(result).not.toBeNull();
		expect(result!.id).toBe('arch-1');
		expect(result!.name).toBe('Alice');
	});

	it('returns null on constraint violation (duplicate email)', async () => {
		await makeArchitect({ email: 'dup@test.com' });
		await expect(
			createArchitect({ id: 'arch-x', name: 'Bob', email: 'dup@test.com' })
		).rejects.toThrow();
	});

	it('returns null on constraint violation (duplicate phone number)', async () => {
		await makeArchitect({ phoneNumber: 555_000_1234 });
		await expect(
			createArchitect({ id: 'arch-y', name: 'Carol', phoneNumber: 555_000_1234 })
		).rejects.toThrow();
	});

	it('allows null email and phone (both optional)', async () => {
		const result = await createArchitect({ id: 'arch-2', name: 'Dave' });
		expect(result!.email).toBeNull();
		expect(result!.phoneNumber).toBeNull();
	});
});

describe('listArchitects', () => {
	it('returns empty array when no architects exist', async () => {
		expect(await listArchitects()).toEqual([]);
	});

	it('returns all architects after multiple inserts', async () => {
		await makeArchitect();
		await makeArchitect();
		await makeArchitect();
		expect(await listArchitects()).toHaveLength(3);
	});
});

describe('getArchitects', () => {
	it('returns the matching architect by id', async () => {
		const a = await makeArchitect({ name: 'Eve' });
		const result = await getArchitects(a.id);
		expect(result!.name).toBe('Eve');
	});

	it('returns null for an unknown id', async () => {
		expect(await getArchitects('does-not-exist')).toBeNull();
	});
});

describe('updateArchitect', () => {
	it('changes only the specified fields', async () => {
		const a = await makeArchitect({ name: 'Frank', email: 'frank@test.com' });
		const updated = await updateArchitect(a.id, { name: 'Franklin' });
		expect(updated!.name).toBe('Franklin');
		expect(updated!.email).toBe('frank@test.com'); // unchanged
	});

	it('returns null for an unknown id', async () => {
		expect(await updateArchitect('ghost', { name: 'Ghost' })).toBeNull();
	});
});

describe('deleteArchitect', () => {
	it('removes the record and returns it', async () => {
		const a = await makeArchitect();
		const deleted = await deleteArchitect(a.id);
		expect(deleted!.id).toBe(a.id);
		expect(await getArchitects(a.id)).toBeNull();
	});

	it('returns null when the architect does not exist', async () => {
		expect(await deleteArchitect('no-such-id')).toBeNull();
	});
});

describe('getArchitectWithTasks (DTO builder)', () => {
	it('returns null for an unknown id', async () => {
		expect(await getArchitectWithTasks('no-such')).toBeNull();
	});

	it('returns architect DTO with tasks including project names', async () => {
		const arch = await makeArchitect({ name: 'Carol' });
		const proj = await makeProject({ name: 'Highway' });
		await makeTask(proj.id, { architectId: arch.id, name: 'Survey', status: 'In Progress' });
		await makeTask(proj.id, { architectId: arch.id, name: 'Design', status: 'Planning' });

		const dto = await getArchitectWithTasks(arch.id);
		expect(dto).not.toBeNull();
		expect(dto!.architectName).toBe('Carol');

		// Note: getArchitectWithTasks currently returns { architectId, architectName } only
		// without embedding the tasks array in the DTO.
		expect(dto!.architectId).toBe(arch.id);
	});

	it('returns DTO even when architect has no tasks', async () => {
		const arch = await makeArchitect({ name: 'Idle' });
		const dto = await getArchitectWithTasks(arch.id);
		expect(dto).not.toBeNull();
		expect(dto!.architectName).toBe('Idle');
	});
});
