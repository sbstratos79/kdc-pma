// src/tests/integration/reports.repo.test.ts

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
  const { testDb } = await import('../helpers/test-db');
  return { db: testDb };
});

import { setupSchema, clearTables } from '../helpers/test-db';
import {
  makeArchitect, makeProject, makeTask,
  TODAY, YESTERDAY, TOMORROW, LAST_WEEK, NEXT_WEEK,
  daysAgo, expectedDaysOverdue,
} from '../helpers/factories';
import {
  getProjectStatusSummary,
  getArchitectWorkload,
  getOverdueTasks,
  getStatusAndPriorityBreakdown,
  getAllReports,
} from '$lib/server/db/repos/reports.repo';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());

// ---------------------------------------------------------------------------
// getProjectStatusSummary
// ---------------------------------------------------------------------------
describe('getProjectStatusSummary', () => {
  it('returns an empty array when there are no projects', async () => {
    expect(await getProjectStatusSummary({})).toEqual([]);
  });

  it('computes totalTasks, completedTasks and completionRate correctly', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { status: 'Completed' });
    await makeTask(proj.id, { status: 'Completed' });
    await makeTask(proj.id, { status: 'In Progress' });
    const [row] = await getProjectStatusSummary({});
    expect(row.totalTasks).toBe(3);
    expect(row.completedTasks).toBe(2);
    expect(row.completionRate).toBe(67); // round(2/3*100)
  });

  it('sets completionRate to 0 (not NaN) when a project has no tasks', async () => {
    await makeProject();
    const [row] = await getProjectStatusSummary({});
    expect(row.totalTasks).toBe(0);
    expect(row.completionRate).toBe(0);
    expect(Number.isNaN(row.completionRate)).toBe(false);
  });

  it('flags isOverdue for a project past its due date that is not Completed', async () => {
    await makeProject({ dueDate: YESTERDAY, status: 'In Progress' });
    const [row] = await getProjectStatusSummary({});
    expect(row.isOverdue).toBe(true);
  });

  it('does NOT flag isOverdue for a Completed project even if past due date', async () => {
    await makeProject({ dueDate: YESTERDAY, status: 'Completed' });
    const [row] = await getProjectStatusSummary({});
    expect(row.isOverdue).toBe(false);
  });

  it('counts overdueTasks correctly (past-due non-Completed tasks only)', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'In Progress' }); // overdue
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Completed' });   // not counted
    await makeTask(proj.id, { dueDate: TOMORROW,  status: 'Planning' });    // not overdue
    const [row] = await getProjectStatusSummary({});
    expect(row.overdueTasks).toBe(1);
  });

  it('filters by status', async () => {
    await makeProject({ status: 'Planning' });
    await makeProject({ status: 'Completed' });
    const result = await getProjectStatusSummary({ status: 'Planning' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Planning');
  });

  it('filters by priority', async () => {
    await makeProject({ priority: 'High' });
    await makeProject({ priority: 'Low' });
    const result = await getProjectStatusSummary({ priority: 'High' });
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe('High');
  });

  it('filters by dateFrom/dateTo on addedTime', async () => {
    await makeProject({ addedTime: LAST_WEEK });
    await makeProject({ addedTime: TODAY });
    const result = await getProjectStatusSummary({ dateFrom: YESTERDAY, dateTo: TOMORROW });
    expect(result).toHaveLength(1);
  });

  it('filters by architectId — only shows projects with tasks from that architect', async () => {
    const arch1 = await makeArchitect();
    const arch2 = await makeArchitect();
    const proj1 = await makeProject({ name: 'Arch1 Project' });
    const proj2 = await makeProject({ name: 'Arch2 Project' });
    await makeTask(proj1.id, { architectId: arch1.id });
    await makeTask(proj2.id, { architectId: arch2.id });
    const result = await getProjectStatusSummary({ architectId: arch1.id });
    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBe('Arch1 Project');
  });

  it('with architectId filter counts only that architect\'s tasks in completionRate', async () => {
    const arch1 = await makeArchitect();
    const arch2 = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch1.id, status: 'Completed' });
    await makeTask(proj.id, { architectId: arch2.id, status: 'Planning' }); // should be excluded
    const [row] = await getProjectStatusSummary({ architectId: arch1.id });
    expect(row.totalTasks).toBe(1);
    expect(row.completionRate).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getArchitectWorkload
// ---------------------------------------------------------------------------
describe('getArchitectWorkload', () => {
  it('returns a row for every architect even with no tasks', async () => {
    await makeArchitect({ name: 'Solo' });
    const result = await getArchitectWorkload({});
    expect(result).toHaveLength(1);
    expect(result[0].totalTasks).toBe(0);
    expect(result[0].activeTasks).toBe(0);
    expect(result[0].overdueTasks).toBe(0);
  });

  it('counts totalTasks and activeTasks correctly', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch.id, status: 'In Progress' });
    await makeTask(proj.id, { architectId: arch.id, status: 'Completed' });
    await makeTask(proj.id, { architectId: arch.id, status: 'Cancelled' });
    const [row] = await getArchitectWorkload({});
    expect(row.totalTasks).toBe(3);
    // Completed and Cancelled are not "active"
    expect(row.activeTasks).toBe(1);
  });

  it('counts overdueTasks correctly', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch.id, dueDate: YESTERDAY, status: 'Planning' });
    await makeTask(proj.id, { architectId: arch.id, dueDate: YESTERDAY, status: 'Completed' });
    await makeTask(proj.id, { architectId: arch.id, dueDate: TOMORROW,  status: 'Planning' });
    const [row] = await getArchitectWorkload({});
    expect(row.overdueTasks).toBe(1);
  });

  it('populates byStatus counts correctly', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch.id, status: 'Planning' });
    await makeTask(proj.id, { architectId: arch.id, status: 'Planning' });
    await makeTask(proj.id, { architectId: arch.id, status: 'In Progress' });
    const [row] = await getArchitectWorkload({});
    expect(row.byStatus['Planning']).toBe(2);
    expect(row.byStatus['In Progress']).toBe(1);
    expect(row.byStatus['Completed']).toBe(0);
  });

  it('populates byPriority counts correctly', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch.id, priority: 'High' });
    await makeTask(proj.id, { architectId: arch.id, priority: 'High' });
    await makeTask(proj.id, { architectId: arch.id, priority: 'Low' });
    const [row] = await getArchitectWorkload({});
    expect(row.byPriority['High']).toBe(2);
    expect(row.byPriority['Low']).toBe(1);
    expect(row.byPriority['Medium']).toBe(0);
  });

  it('filters to a single architect when architectId is set', async () => {
    const arch1 = await makeArchitect({ name: 'Alpha' });
    await makeArchitect({ name: 'Beta' });
    const result = await getArchitectWorkload({ architectId: arch1.id });
    expect(result).toHaveLength(1);
    expect(result[0].architectName).toBe('Alpha');
  });

  it('filters tasks by date range', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch.id, addedTime: LAST_WEEK });
    await makeTask(proj.id, { architectId: arch.id, addedTime: TODAY });
    const [row] = await getArchitectWorkload({ dateFrom: YESTERDAY, dateTo: TOMORROW });
    expect(row.totalTasks).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getOverdueTasks
// ---------------------------------------------------------------------------
describe('getOverdueTasks', () => {
  it('returns empty array when no tasks are overdue', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { dueDate: TOMORROW, status: 'Planning' });
    expect(await getOverdueTasks({})).toHaveLength(0);
  });

  it('excludes Completed tasks even if past due date', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Completed' });
    expect(await getOverdueTasks({})).toHaveLength(0);
  });

  it('excludes Cancelled tasks even if past due date', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Cancelled' });
    expect(await getOverdueTasks({})).toHaveLength(0);
  });

  it('includes Planning and In Progress tasks that are past due', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Planning' });
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'In Progress' });
    expect(await getOverdueTasks({})).toHaveLength(2);
  });

  it('includes the project and architect name in each row', async () => {
    const arch = await makeArchitect({ name: 'George' });
    const proj = await makeProject({ name: 'Library Extension' });
    await makeTask(proj.id, { architectId: arch.id, dueDate: YESTERDAY, status: 'Planning' });
    const [row] = await getOverdueTasks({});
    expect(row.projectName).toBe('Library Extension');
    expect(row.architectName).toBe('George');
  });

  it('shows "Unassigned" for tasks with no architect', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: null, dueDate: YESTERDAY, status: 'Planning' });
    const [row] = await getOverdueTasks({});
    expect(row.architectName).toBe('Unassigned');
  });

  it('filters by architectId', async () => {
    const arch1 = await makeArchitect();
    const arch2 = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch1.id, dueDate: YESTERDAY, status: 'Planning' });
    await makeTask(proj.id, { architectId: arch2.id, dueDate: YESTERDAY, status: 'Planning' });
    const result = await getOverdueTasks({ architectId: arch1.id });
    expect(result).toHaveLength(1);
    expect(result[0].architectId).toBe(arch1.id);
  });

  it('filters by priority', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Planning', priority: 'High' });
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Planning', priority: 'Low' });
    const result = await getOverdueTasks({ priority: 'High' });
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe('High');
  });

  it('filters by date range on addedTime', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Planning', addedTime: LAST_WEEK });
    await makeTask(proj.id, { dueDate: YESTERDAY, status: 'Planning', addedTime: TODAY });
    const result = await getOverdueTasks({ dateFrom: YESTERDAY, dateTo: TOMORROW });
    expect(result).toHaveLength(1);
  });

  it('sorts by daysOverdue descending', async () => {
    const proj = await makeProject();
    await makeTask(proj.id, { name: 'Recent',  dueDate: daysAgo(2),  status: 'Planning' });
    await makeTask(proj.id, { name: 'Oldest',  dueDate: daysAgo(20), status: 'Planning' });
    await makeTask(proj.id, { name: 'Middle',  dueDate: daysAgo(10), status: 'Planning' });
    const result = await getOverdueTasks({});
    expect(result.map(r => r.taskName)).toEqual(['Oldest', 'Middle', 'Recent']);
  });
});

// ---------------------------------------------------------------------------
// getStatusAndPriorityBreakdown
// ---------------------------------------------------------------------------
describe('getStatusAndPriorityBreakdown', () => {
  it('returns zero counts for all statuses when DB is empty', async () => {
    const { statusFunnel } = await getStatusAndPriorityBreakdown({});
    expect(statusFunnel.every(r => r.projectCount === 0 && r.taskCount === 0)).toBe(true);
  });

  it('returns a row for every canonical status', async () => {
    const { statusFunnel } = await getStatusAndPriorityBreakdown({});
    const statuses = statusFunnel.map(r => r.status);
    expect(statuses).toContain('Planning');
    expect(statuses).toContain('In Progress');
    expect(statuses).toContain('Completed');
    expect(statuses).toContain('On Hold');
    expect(statuses).toContain('Cancelled');
  });

  it('counts projects and tasks per status correctly', async () => {
    await makeProject({ status: 'Planning' });
    await makeProject({ status: 'Planning' });
    await makeProject({ status: 'Completed' });
    const proj = await makeProject({ status: 'In Progress' });
    await makeTask(proj.id, { status: 'In Progress' });
    await makeTask(proj.id, { status: 'Planning' });

    const { statusFunnel } = await getStatusAndPriorityBreakdown({});
    const planning   = statusFunnel.find(r => r.status === 'Planning')!;
    const completed  = statusFunnel.find(r => r.status === 'Completed')!;
    const inProgress = statusFunnel.find(r => r.status === 'In Progress')!;

    expect(planning.projectCount).toBe(2);
    expect(planning.taskCount).toBe(1);
    expect(completed.projectCount).toBe(1);
    expect(inProgress.projectCount).toBe(1);
    expect(inProgress.taskCount).toBe(1);
  });

  it('priority distribution returns a row for every canonical priority', async () => {
    const { priorityDistribution } = await getStatusAndPriorityBreakdown({});
    const priorities = priorityDistribution.map(r => r.priority);
    expect(priorities).toContain('High');
    expect(priorities).toContain('Medium');
    expect(priorities).toContain('Low');
  });

  it('counts projects and tasks per priority correctly', async () => {
    await makeProject({ priority: 'High' });
    await makeProject({ priority: 'High' });
    await makeProject({ priority: 'Low' });
    const proj = await makeProject({ priority: 'Medium' });
    await makeTask(proj.id, { priority: 'High' });

    const { priorityDistribution } = await getStatusAndPriorityBreakdown({});
    const high   = priorityDistribution.find(r => r.priority === 'High')!;
    const low    = priorityDistribution.find(r => r.priority === 'Low')!;
    const medium = priorityDistribution.find(r => r.priority === 'Medium')!;

    expect(high.projectCount).toBe(2);
    expect(high.taskCount).toBe(1);
    expect(low.projectCount).toBe(1);
    expect(medium.projectCount).toBe(1);
  });

  it('filters tasks by architectId', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch.id, status: 'In Progress' });
    await makeTask(proj.id, {                        status: 'In Progress' });
    const { statusFunnel } = await getStatusAndPriorityBreakdown({ architectId: arch.id });
    const inProgress = statusFunnel.find(r => r.status === 'In Progress')!;
    expect(inProgress.taskCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getAllReports
// ---------------------------------------------------------------------------
describe('getAllReports', () => {
  it('returns all five top-level keys with an empty DB', async () => {
    const report = await getAllReports({});
    expect(report).toHaveProperty('projectSummary');
    expect(report).toHaveProperty('architectWorkload');
    expect(report).toHaveProperty('overdueTasks');
    expect(report).toHaveProperty('statusFunnel');
    expect(report).toHaveProperty('priorityDistribution');
  });

  it('does not throw with a completely empty DB', async () => {
    await expect(getAllReports({})).resolves.not.toThrow();
  });

  it('includes appliedFilters and generatedAt metadata', async () => {
    const filters = { status: 'Planning', priority: 'High' };
    const report = await getAllReports(filters);
    expect(report.appliedFilters).toMatchObject(filters);
    expect(typeof report.generatedAt).toBe('string');
    expect(new Date(report.generatedAt).getTime()).not.toBeNaN();
  });

  it('applies combined filters across all sub-reports', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject({ status: 'In Progress', priority: 'High' });
    await makeTask(proj.id, { architectId: arch.id, status: 'In Progress', priority: 'High' });

    // Filter that should match the data above
    const report = await getAllReports({
      status: 'In Progress',
      priority: 'High',
      architectId: arch.id,
    });

    expect(report.projectSummary).toHaveLength(1);
    expect(report.architectWorkload).toHaveLength(1);
    expect(report.architectWorkload[0].totalTasks).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('a future dateFrom that matches nothing returns empty results', async () => {
    await makeProject();
    const result = await getProjectStatusSummary({ dateFrom: NEXT_WEEK });
    expect(result).toHaveLength(0);
  });

  it('combining all filters still returns valid (possibly empty) results', async () => {
    const arch = await makeArchitect();
    const report = await getAllReports({
      dateFrom: YESTERDAY,
      dateTo: TOMORROW,
      architectId: arch.id,
      status: 'Completed',
      priority: 'High',
    });
    expect(Array.isArray(report.projectSummary)).toBe(true);
    expect(Array.isArray(report.overdueTasks)).toBe(true);
  });
});
