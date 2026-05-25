// src/tests/api/reports.test.ts
//
// Tests GET /api/reports with all type variants and filter combinations.

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
  const { testDb } = await import('../helpers/test-db');
  return { db: testDb };
});

import { setupSchema, clearTables } from '../helpers/test-db';
import {
  makeArchitect, makeProject, makeTask,
  TODAY, YESTERDAY, TOMORROW, NEXT_WEEK,
} from '../helpers/factories';
import { GET } from '../../routes/api/reports/+server';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function getReport(qs: string) {
  const url = new URL(`http://localhost/api/reports?${qs}`);
  const response = await GET({ url } as any);
  return response.json();
}

// ---------------------------------------------------------------------------
// type=all (default)
// ---------------------------------------------------------------------------
describe('GET /api/reports — type=all', () => {
  it('returns all five top-level keys', async () => {
    const json = await getReport('type=all');
    expect(json.data).toHaveProperty('projectSummary');
    expect(json.data).toHaveProperty('architectWorkload');
    expect(json.data).toHaveProperty('overdueTasks');
    expect(json.data).toHaveProperty('statusFunnel');
    expect(json.data).toHaveProperty('priorityDistribution');
  });

  it('responds with { data: ... } shape (no error key on success)', async () => {
    const json = await getReport('type=all');
    expect(json.error).toBeUndefined();
    expect(json.data).toBeDefined();
  });

  it('falls back to type=all when type param is omitted', async () => {
    const url = new URL('http://localhost/api/reports');
    const json = await (await GET({ url } as any)).json();
    expect(json.data).toHaveProperty('projectSummary');
  });

  it('falls back to type=all for an unknown type param', async () => {
    const json = await getReport('type=unicorn');
    expect(json.data).toHaveProperty('projectSummary');
  });
});

// ---------------------------------------------------------------------------
// Individual type variants
// ---------------------------------------------------------------------------
describe('GET /api/reports — individual types', () => {
  it('type=project-summary returns an array', async () => {
    await makeProject();
    const json = await getReport('type=project-summary');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('type=architect-workload returns an array', async () => {
    await makeArchitect();
    const json = await getReport('type=architect-workload');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('type=overdue-tasks returns an array', async () => {
    const json = await getReport('type=overdue-tasks');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('type=status-funnel returns an array with status keys', async () => {
    const json = await getReport('type=status-funnel');
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toHaveProperty('status');
    expect(json.data[0]).toHaveProperty('projectCount');
    expect(json.data[0]).toHaveProperty('taskCount');
  });

  it('type=priority-distribution returns an array with priority keys', async () => {
    const json = await getReport('type=priority-distribution');
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toHaveProperty('priority');
  });
});

// ---------------------------------------------------------------------------
// Filter params forwarded correctly
// ---------------------------------------------------------------------------
describe('GET /api/reports — filter forwarding', () => {
  it('status filter narrows projectSummary results', async () => {
    await makeProject({ status: 'Planning' });
    await makeProject({ status: 'Completed' });
    const json = await getReport('type=all&status=Planning');
    expect(json.data.projectSummary).toHaveLength(1);
    expect(json.data.projectSummary[0].status).toBe('Planning');
  });

  it('priority filter narrows projectSummary results', async () => {
    await makeProject({ priority: 'High' });
    await makeProject({ priority: 'Low' });
    const json = await getReport('type=all&priority=High');
    expect(json.data.projectSummary).toHaveLength(1);
    expect(json.data.projectSummary[0].priority).toBe('High');
  });

  it('architectId filter narrows workload to one architect', async () => {
    const arch1 = await makeArchitect();
    await makeArchitect();
    const json = await getReport(`type=all&architectId=${arch1.id}`);
    expect(json.data.architectWorkload).toHaveLength(1);
    expect(json.data.architectWorkload[0].architectId).toBe(arch1.id);
  });

  it('dateFrom in the far future produces empty projectSummary', async () => {
    await makeProject({ addedTime: TODAY });
    const json = await getReport(`type=all&dateFrom=${NEXT_WEEK}`);
    expect(json.data.projectSummary).toHaveLength(0);
  });

  it('dateFrom+dateTo range includes today\'s records', async () => {
    await makeProject({ addedTime: TODAY });
    const json = await getReport(`type=all&dateFrom=${YESTERDAY}&dateTo=${TOMORROW}`);
    expect(json.data.projectSummary).toHaveLength(1);
  });

  it('combined filters all apply together', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject({ status: 'In Progress', priority: 'High', addedTime: TODAY });
    await makeTask(proj.id, { architectId: arch.id });
    // A project that should be excluded
    await makeProject({ status: 'Planning', priority: 'Low', addedTime: TODAY });

    const json = await getReport(
      `type=all&status=In Progress&priority=High&architectId=${arch.id}&dateFrom=${YESTERDAY}&dateTo=${TOMORROW}`
    );
    expect(json.data.projectSummary).toHaveLength(1);
    expect(json.data.projectSummary[0].status).toBe('In Progress');
  });
});
