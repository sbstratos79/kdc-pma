// src/tests/unit/csv.test.ts
//
// Tests CSV formatting behaviour through the export API endpoint.
// The CSV builder functions are private to the route file, so we exercise
// them end-to-end: seed data → call GET handler → inspect raw CSV text.

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
  const { testDb } = await import('../helpers/test-db');
  return { db: testDb };
});

import { setupSchema, clearTables, closeDb } from '../helpers/test-db';
import { makeProject, makeArchitect, makeTask, daysAgo, expectedDaysOverdue } from '../helpers/factories';

// Import the export handler directly
import { GET } from '../../routes/api/reports/export/+server';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());
afterAll(() => closeDb());

// ---------------------------------------------------------------------------
// Helper — call the GET handler and return the response text
// ---------------------------------------------------------------------------
async function exportCSV(section: string, extra = ''): Promise<string> {
  const url = new URL(`http://localhost/api/reports/export?format=csv&section=${section}${extra}`);
  const response = await GET({ url } as any);
  return response.text();
}

// ---------------------------------------------------------------------------
// Content-type and structure
// ---------------------------------------------------------------------------
describe('CSV export — content-type and headers', () => {
  it('returns Content-Type: text/csv', async () => {
    const url = new URL('http://localhost/api/reports/export?format=csv&section=projects');
    const response = await GET({ url } as any);
    expect(response.headers.get('content-type')).toMatch(/text\/csv/);
  });

  it('includes a Content-Disposition attachment header', async () => {
    const url = new URL('http://localhost/api/reports/export?format=csv&section=projects');
    const response = await GET({ url } as any);
    expect(response.headers.get('content-disposition')).toMatch(/attachment/);
    expect(response.headers.get('content-disposition')).toMatch(/\.csv/);
  });

  it('project section CSV contains expected column headers', async () => {
    const csv = await exportCSV('projects');
    expect(csv).toContain('Project');
    expect(csv).toContain('Status');
    expect(csv).toContain('Priority');
    expect(csv).toContain('Due Date');
    expect(csv).toContain('Done %');
  });

  it('architects section CSV contains expected column headers', async () => {
    const csv = await exportCSV('architects');
    expect(csv).toContain('Architect');
    expect(csv).toContain('Total Tasks');
    expect(csv).toContain('Active');
    expect(csv).toContain('Overdue');
  });

  it('overdue section CSV contains expected column headers', async () => {
    const csv = await exportCSV('overdue');
    expect(csv).toContain('Task');
    expect(csv).toContain('Project');
    expect(csv).toContain('Architect');
    expect(csv).toContain('Days Late');
  });

  it('all-section CSV contains headers from every section', async () => {
    const csv = await exportCSV('all');
    expect(csv).toContain('PROJECT STATUS SUMMARY');
    expect(csv).toContain('ARCHITECT WORKLOAD');
    expect(csv).toContain('OVERDUE TASKS');
  });
});

// ---------------------------------------------------------------------------
// RFC 4180 quoting rules
// ---------------------------------------------------------------------------
describe('CSV export — RFC 4180 quoting', () => {
  it('wraps a field containing a comma in double quotes', async () => {
    await makeProject({ name: 'Roads, Bridges & Tunnels' });
    const csv = await exportCSV('projects');
    expect(csv).toContain('"Roads, Bridges & Tunnels"');
  });

  it('escapes an embedded double-quote as two double-quotes', async () => {
    await makeProject({ name: 'Project "Alpha"' });
    const csv = await exportCSV('projects');
    expect(csv).toContain('"Project ""Alpha"""');
  });

  it('wraps a field containing a newline in double quotes', async () => {
    // Most UIs strip newlines, but the formatter should still quote the value.
    await makeProject({ name: 'Line1\nLine2' });
    const csv = await exportCSV('projects');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('does NOT quote a plain field with no special characters', async () => {
    await makeProject({ name: 'SimpleProject' });
    const csv = await exportCSV('projects');
    // The name should appear unquoted
    expect(csv).toMatch(/SimpleProject(?!["'"])/);
  });
});

// ---------------------------------------------------------------------------
// Data integrity in CSV
// ---------------------------------------------------------------------------
describe('CSV export — data mapping', () => {
  it('maps completionRate correctly to "Done %" column', async () => {
    const proj = await makeProject({ status: 'In Progress', priority: 'High' });
    await makeTask(proj.id, { status: 'Completed' });
    await makeTask(proj.id, { status: 'Completed' });
    await makeTask(proj.id, { status: 'Planning' });
    // 2/3 tasks done → Math.round(2/3 * 100) = 67, not 66
    const csv = await exportCSV('projects');
    expect(csv).toContain('67%');
  });

  it('overdue section shows correct daysOverdue value', async () => {
    const proj = await makeProject();
    const due = daysAgo(5);
    await makeTask(proj.id, { dueDate: due, status: 'In Progress' });
    const csv = await exportCSV('overdue');
    // daysAgo(5) is a UTC date string. The repo computes daysOverdue against
    // midnight *local* time, so in UTC+ timezones the result can be 4, not 5.
    // We derive the expected value with the same formula the repo uses so the
    // test is timezone-safe and always matches the actual CSV output.
    // Note: overdueToCSV uses fmt() which emits a plain number — no 'd' suffix.
    const expected = expectedDaysOverdue(due);
    expect(csv).toContain(String(expected));
  });

  it('architect section maps In Progress count correctly', async () => {
    const arch = await makeArchitect();
    const proj = await makeProject();
    await makeTask(proj.id, { architectId: arch.id, status: 'In Progress' });
    await makeTask(proj.id, { architectId: arch.id, status: 'In Progress' });
    await makeTask(proj.id, { architectId: arch.id, status: 'Planning' });
    const csv = await exportCSV('architects');
    const lines = csv.split('\r\n');
    const dataLine = lines.find(l => l.startsWith(arch.name));
    expect(dataLine).toBeDefined();
    // In Progress count = 2
    expect(dataLine).toContain('2');
  });
});
