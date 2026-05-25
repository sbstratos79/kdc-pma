// src/tests/unit/report-helpers.test.ts
//
// Tests the inDateRange and daysOverdue helper logic that lives inside
// reports.repo.ts.  Because those helpers are private we exercise them
// through the public repo functions — this is the correct unit-test
// boundary: test *behaviour*, not implementation details.

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
	const { testDb } = await import('../helpers/test-db');
	return { db: testDb };
});

import { setupSchema, clearTables } from '../helpers/test-db';
import {
	makeProject,
	makeTask,
	TODAY,
	YESTERDAY,
	TOMORROW,
	LAST_WEEK,
	daysAgo,
	expectedDaysOverdue
} from '../helpers/factories';
import { getProjectStatusSummary, getOverdueTasks } from '$lib/server/db/repos/reports.repo';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());

// ---------------------------------------------------------------------------
// inDateRange
// ---------------------------------------------------------------------------
describe('inDateRange (via getProjectStatusSummary)', () => {
	it('includes all records when no filter is set', async () => {
		await makeProject();
		await makeProject();
		expect(await getProjectStatusSummary({})).toHaveLength(2);
	});

	it('includes a record whose dueDate equals dateFrom (inclusive boundary)', async () => {
		await makeProject({ dueDate: TODAY });
		expect(await getProjectStatusSummary({ dateFrom: TODAY })).toHaveLength(1);
	});

	it('includes a record whose dueDate equals dateTo (inclusive boundary)', async () => {
		await makeProject({ dueDate: TODAY });
		expect(await getProjectStatusSummary({ dateTo: TODAY })).toHaveLength(1);
	});

	it('excludes a record whose dueDate is before dateFrom', async () => {
		await makeProject({ dueDate: YESTERDAY });
		expect(await getProjectStatusSummary({ dateFrom: TODAY })).toHaveLength(0);
	});

	it('excludes a record whose dueDate is after dateTo', async () => {
		await makeProject({ dueDate: TODAY });
		expect(await getProjectStatusSummary({ dateTo: YESTERDAY })).toHaveLength(0);
	});

	it('includes a record within a date range', async () => {
		await makeProject({ dueDate: TODAY });
		const result = await getProjectStatusSummary({ dateFrom: YESTERDAY, dateTo: TOMORROW });
		expect(result).toHaveLength(1);
	});

	it('excludes records outside a narrow date range and keeps those inside', async () => {
		await makeProject({ dueDate: LAST_WEEK }); // outside
		await makeProject({ dueDate: TODAY }); // inside
		const result = await getProjectStatusSummary({ dateFrom: YESTERDAY, dateTo: TOMORROW });
		expect(result).toHaveLength(1);
	});

	it('filters tasks by dueDate for workload queries', async () => {
		const proj = await makeProject();
		await makeTask(proj.id, { dueDate: TODAY });
		await makeTask(proj.id, { dueDate: LAST_WEEK });
		// Only the task from today should count in the summary
		const [row] = await getProjectStatusSummary({ dateFrom: YESTERDAY, dateTo: TOMORROW });
		expect(row.totalTasks).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// daysOverdue
// ---------------------------------------------------------------------------
describe('daysOverdue (via getOverdueTasks)', () => {
	it('does NOT flag a task due today as overdue', async () => {
		const proj = await makeProject();
		await makeTask(proj.id, { dueDate: TODAY, status: 'In Progress' });
		expect(await getOverdueTasks({})).toHaveLength(0);
	});

	it('does NOT flag a task due tomorrow as overdue', async () => {
		const proj = await makeProject();
		await makeTask(proj.id, { dueDate: TOMORROW, status: 'In Progress' });
		expect(await getOverdueTasks({})).toHaveLength(0);
	});

	it('flags a task due yesterday as overdue with daysOverdue = 1', async () => {
		const proj = await makeProject();
		await makeTask(proj.id, { dueDate: YESTERDAY, status: 'In Progress' });
		const result = await getOverdueTasks({});
		expect(result).toHaveLength(1);
		expect(result[0].daysOverdue).toBe(expectedDaysOverdue(YESTERDAY));
	});

	it('computes daysOverdue correctly for a task overdue by many days', async () => {
		const proj = await makeProject();
		const due = daysAgo(30);
		await makeTask(proj.id, { dueDate: due, status: 'Planning' });
		const [row] = await getOverdueTasks({});
		expect(row.daysOverdue).toBe(expectedDaysOverdue(due));
	});

	it('sorts results by daysOverdue descending (worst first)', async () => {
		const proj = await makeProject();
		await makeTask(proj.id, { name: 'Recent', dueDate: daysAgo(2), status: 'Planning' });
		await makeTask(proj.id, { name: 'Ancient', dueDate: daysAgo(14), status: 'Planning' });
		await makeTask(proj.id, { name: 'Middle', dueDate: daysAgo(7), status: 'Planning' });
		const result = await getOverdueTasks({});
		expect(result.map((r) => r.taskName)).toEqual(['Ancient', 'Middle', 'Recent']);
	});
});
