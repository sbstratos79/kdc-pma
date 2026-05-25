// src/tests/api/reports-export.test.ts
//
// Tests GET /api/reports/export for both PDF and CSV formats.

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('$lib/server/db/queries/db', async () => {
	const { testDb } = await import('../helpers/test-db');
	return { db: testDb };
});

import { setupSchema, clearTables } from '../helpers/test-db';
import {
	makeArchitect,
	makeProject,
	makeTask,
	TODAY,
	NEXT_WEEK,
	daysAgo
} from '../helpers/factories';
import { GET } from '../../routes/api/reports/export/+server';

beforeAll(() => setupSchema());
beforeEach(() => clearTables());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function callExport(qs: string): Promise<Response> {
	const url = new URL(`http://localhost/api/reports/export?${qs}`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return GET({ url } as any);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
describe('PDF export', () => {
	it('returns Content-Type: application/pdf', async () => {
		const res = await callExport('format=pdf&section=all');
		expect(res.headers.get('content-type')).toMatch(/application\/pdf/);
	});

	it('returns a Content-Disposition: attachment header with .pdf filename', async () => {
		const res = await callExport('format=pdf&section=all');
		const cd = res.headers.get('content-disposition') ?? '';
		expect(cd).toMatch(/attachment/);
		expect(cd).toMatch(/\.pdf/);
	});

	it('returns a non-empty response body', async () => {
		const res = await callExport('format=pdf&section=all');
		const buf = await res.arrayBuffer();
		expect(buf.byteLength).toBeGreaterThan(100);
	});

	it('starts with the PDF magic bytes (%PDF)', async () => {
		const res = await callExport('format=pdf&section=all');
		const buf = Buffer.from(await res.arrayBuffer());
		expect(buf.subarray(0, 4).toString()).toBe('%PDF');
	});

	it('generates a valid PDF even with an empty database', async () => {
		const res = await callExport('format=pdf&section=all');
		expect(res.status).toBe(200);
		const buf = Buffer.from(await res.arrayBuffer());
		expect(buf.subarray(0, 4).toString()).toBe('%PDF');
	});

	it('generates a PDF scoped to the projects section only', async () => {
		await makeProject({ name: 'Solo Project' });
		const res = await callExport('format=pdf&section=projects');
		expect(res.status).toBe(200);
		const buf = Buffer.from(await res.arrayBuffer());
		expect(buf.byteLength).toBeGreaterThan(100);
	});

	it('applies filters (dateFrom far future) and still produces a valid PDF', async () => {
		await makeProject();
		const res = await callExport(`format=pdf&section=all&dateFrom=${NEXT_WEEK}`);
		expect(res.status).toBe(200);
		const buf = Buffer.from(await res.arrayBuffer());
		expect(buf.subarray(0, 4).toString()).toBe('%PDF');
	});
});

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
describe('CSV export', () => {
	it('returns Content-Type: text/csv', async () => {
		const res = await callExport('format=csv&section=projects');
		expect(res.headers.get('content-type')).toMatch(/text\/csv/);
	});

	it('returns a Content-Disposition: attachment header with .csv filename', async () => {
		const res = await callExport('format=csv&section=projects');
		const cd = res.headers.get('content-disposition') ?? '';
		expect(cd).toMatch(/attachment/);
		expect(cd).toMatch(/\.csv/);
	});

	it('section=projects only contains project headers, not overdue headers', async () => {
		const csv = await (await callExport('format=csv&section=projects')).text();
		expect(csv).toContain('PROJECT STATUS SUMMARY');
		expect(csv).not.toContain('OVERDUE TASKS');
		expect(csv).not.toContain('ARCHITECT WORKLOAD');
	});

	it('section=architects only contains architect headers', async () => {
		const csv = await (await callExport('format=csv&section=architects')).text();
		expect(csv).toContain('ARCHITECT WORKLOAD');
		expect(csv).not.toContain('PROJECT STATUS SUMMARY');
	});

	it('section=overdue only contains overdue headers', async () => {
		const csv = await (await callExport('format=csv&section=overdue')).text();
		expect(csv).toContain('OVERDUE TASKS');
		expect(csv).not.toContain('PROJECT STATUS SUMMARY');
	});

	it('section=all contains all three section headers', async () => {
		const csv = await (await callExport('format=csv&section=all')).text();
		expect(csv).toContain('PROJECT STATUS SUMMARY');
		expect(csv).toContain('ARCHITECT WORKLOAD');
		expect(csv).toContain('OVERDUE TASKS');
	});

	it('project data appears in the CSV body', async () => {
		await makeProject({ name: 'CSV Test Project' });
		const csv = await (await callExport('format=csv&section=projects')).text();
		expect(csv).toContain('CSV Test Project');
	});

	it('architect data appears in the CSV body', async () => {
		await makeArchitect({ name: 'CSV Arch' });
		const csv = await (await callExport('format=csv&section=architects')).text();
		expect(csv).toContain('CSV Arch');
	});

	it('overdue task data appears in the CSV body', async () => {
		const proj = await makeProject();
		await makeTask(proj.id, {
			name: 'CSV Overdue Task',
			dueDate: daysAgo(3),
			status: 'In Progress'
		});
		const csv = await (await callExport('format=csv&section=overdue')).text();
		expect(csv).toContain('CSV Overdue Task');
	});
});

// ---------------------------------------------------------------------------
// Filter forwarding to export
// ---------------------------------------------------------------------------
describe('export — filter forwarding', () => {
	it('status filter reduces exported project rows', async () => {
		await makeProject({ name: 'Planning One', status: 'Planning' });
		await makeProject({ name: 'Completed One', status: 'Completed' });
		const csv = await (await callExport('format=csv&section=projects&status=Planning')).text();
		expect(csv).toContain('Planning One');
		expect(csv).not.toContain('Completed One');
	});

	it('architectId filter reduces exported architect rows', async () => {
		const arch1 = await makeArchitect({ name: 'Arch Alpha' });
		await makeArchitect({ name: 'Arch Beta' });
		const csv = await (
			await callExport(`format=csv&section=architects&architectId=${arch1.id}`)
		).text();
		expect(csv).toContain('Arch Alpha');
		expect(csv).not.toContain('Arch Beta');
	});

	it('dateFrom in the far future produces a CSV with no project data rows', async () => {
		await makeProject({ name: 'Old Project', dueDate: TODAY });
		const csv = await (
			await callExport(`format=csv&section=projects&dateFrom=${NEXT_WEEK}`)
		).text();
		// Header should still be there, but no data row
		expect(csv).toContain('PROJECT STATUS SUMMARY');
		expect(csv).not.toContain('Old Project');
	});
});
