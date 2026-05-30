// src/routes/api/reports/export/+server.ts
//
// GET /api/reports/export?format=pdf|csv&section=all|projects|architects|overdue
//     &dateFrom=&dateTo=&architectId=&status=&priority=
//
// Dependencies: npm install pdfkit @types/pdfkit

import type { RequestHandler } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { catchHandler, extractFilters } from '$lib/server/api-utils';
import {
	getAllReports,
	type AllReports,
	type ProjectSummaryRow,
	type ArchitectWorkloadRow,
	type OverdueTaskRow
} from '$lib/server/db/repos/reports.repo';
import { PUBLIC_LOGO_FILE_NAME, PUBLIC_PROJECT_TITLE } from '$env/static/public';

const logo = PUBLIC_LOGO_FILE_NAME;
const title = PUBLIC_PROJECT_TITLE;

function fmt(val: string | number | null | undefined): string {
	if (val === null || val === undefined) return '—';
	return String(val);
}

function fmtDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	return iso.substring(0, 10);
}

// ---------------------------------------------------------------------------
// CSV builders
// ---------------------------------------------------------------------------

function toCSV(headers: string[], rows: string[][]): string {
	const escape = (v: string) =>
		v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
	const lines = [headers.map(escape).join(',')];
	for (const row of rows) lines.push(row.map(escape).join(','));
	return lines.join('\r\n');
}

function projectsToCSV(data: ProjectSummaryRow[]): string {
	const headers = [
		'Project',
		'Status',
		'Priority',
		'Start Date',
		'Due Date',
		'Total Tasks',
		'Completed',
		'Overdue',
		'Done %'
	];
	const rows = data.map((p) => [
		p.projectName,
		p.status,
		p.priority,
		fmtDate(p.startDate),
		fmtDate(p.dueDate),
		fmt(p.totalTasks),
		fmt(p.completedTasks),
		fmt(p.overdueTasks),
		`${p.completionRate}%`
	]);
	return toCSV(headers, rows);
}

function architectsToCSV(data: ArchitectWorkloadRow[]): string {
	const headers = [
		'Architect',
		'Total Tasks',
		'Active',
		'Overdue',
		'In Progress',
		'Completed',
		'High Priority'
	];
	const rows = data.map((a) => [
		a.architectName,
		fmt(a.totalTasks),
		fmt(a.activeTasks),
		fmt(a.overdueTasks),
		fmt(a.byStatus['In Progress']),
		fmt(a.byStatus['Completed']),
		fmt(a.byPriority['High'])
	]);
	return toCSV(headers, rows);
}

function overdueToCSV(data: OverdueTaskRow[]): string {
	const headers = ['Task', 'Project', 'Architect', 'Status', 'Priority', 'Was Due', 'Days Late'];
	const rows = data.map((t) => [
		t.taskName,
		t.projectName,
		t.architectName,
		t.status,
		t.priority,
		fmtDate(t.dueDate),
		fmt(t.daysOverdue)
	]);
	return toCSV(headers, rows);
}

function buildCSV(reports: AllReports, section: string): string {
	const parts: string[] = [];
	const generatedAt = `Generated: ${new Date(reports.generatedAt).toLocaleString()}`;

	if (section === 'all' || section === 'projects') {
		parts.push('PROJECT STATUS SUMMARY');
		parts.push(generatedAt);
		parts.push(projectsToCSV(reports.projectSummary));
	}
	if (section === 'all' || section === 'architects') {
		if (parts.length) parts.push('');
		parts.push('ARCHITECT WORKLOAD');
		parts.push(generatedAt);
		parts.push(architectsToCSV(reports.architectWorkload));
	}
	if (section === 'all' || section === 'overdue') {
		if (parts.length) parts.push('');
		parts.push('OVERDUE TASKS');
		parts.push(generatedAt);
		parts.push(overdueToCSV(reports.overdueTasks));
	}
	return parts.join('\r\n');
}

// ---------------------------------------------------------------------------
// PDF builder
// ---------------------------------------------------------------------------

async function buildPDF(reports: AllReports, section: string): Promise<Buffer> {
	// Dynamically imported so the module doesn't crash if pdfkit isn't installed
	const PDFDocument = (await import('pdfkit')).default;

	const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
	const chunks: Buffer[] = [];
	doc.on('data', (c: Buffer) => chunks.push(c));

	const PAGE_W = doc.page.width - 100; // usable width with 50px margins each side
	const NAVY = '#1e3a5f';
	const SLATE = '#64748b';
	const GREEN = '#16a34a';
	const BLUE = '#2563eb';
	const AMBER = '#d97706';
	const RED = '#dc2626';
	const generatedAt = new Date(reports.generatedAt).toLocaleString();
	const logoPath = path.resolve(process.cwd(), 'static' + logo);

	// ---- helpers ----

	function statusColor(status: string): string {
		switch (status) {
			case 'Completed':
				return GREEN;
			case 'In Progress':
				return BLUE;
			case 'Planning':
				return AMBER;
			case 'On Hold':
				return SLATE;
			case 'Cancelled':
				return RED;
			default:
				return SLATE;
		}
	}

	function priorityColor(priority: string): string {
		switch (priority) {
			case 'High':
				return RED;
			case 'Medium':
				return AMBER;
			case 'Low':
				return GREEN;
			default:
				return SLATE;
		}
	}

	// ---- helpers ----

	function heading(text: string) {
		doc
			.moveDown(0.5)
			.fontSize(13)
			.font('Helvetica-Bold')
			.fillColor(NAVY)
			.text(text, 50, doc.y, { width: PAGE_W })
			.moveDown(0.3);
		doc
			.moveTo(50, doc.y)
			.lineTo(50 + PAGE_W, doc.y)
			.strokeColor('#cbd5e1')
			.lineWidth(1)
			.stroke();
		doc.moveDown(0.4);
	}

	function subtext(text: string) {
		doc
			.fontSize(8)
			.font('Helvetica')
			.fillColor(SLATE)
			.text(text, 50, doc.y, { width: PAGE_W })
			.moveDown(0.4);
	}

	function statCard(
		label: string,
		value: string | number,
		x: number,
		y: number,
		w: number,
		accent: string = NAVY
	) {
		doc.rect(x, y, w, 44).fill('#f8fafc');
		doc.rect(x, y, 3, 44).fill(accent);
		doc
			.fontSize(18)
			.font('Helvetica-Bold')
			.fillColor(accent)
			.text(String(value), x + 10, y + 6, { width: w - 18, align: 'left' });
		doc
			.fontSize(8)
			.font('Helvetica')
			.fillColor(SLATE)
			.text(label, x + 10, y + 28, { width: w - 18 });
	}

	function table(
		headers: string[],
		rows: string[][],
		colWidths: number[],
		startY: number,
		cellColors?: (string | undefined)[][]
	): number {
		const rowH = 18;
		let y = startY;
		const x = 50;

		// Header row
		const headerGrad = doc.linearGradient(x, y, x + PAGE_W, y);
		headerGrad.stop(0, '#dcfce7').stop(1, '#bbf7d0');
		doc.rect(x, y, PAGE_W, rowH).fill(headerGrad);
		doc.fill('#1f2937').font('Helvetica-Bold').fontSize(7.5);
		let cx = x + 4;
		headers.forEach((h, i) => {
			doc.text(h, cx, y + 5, { width: colWidths[i] - 6, lineBreak: false, ellipsis: true });
			cx += colWidths[i];
		});
		y += rowH;

		// Data rows — track page-start y for per-page border segments
		let segmentStartY = y;
		rows.forEach((row, ri) => {
			if (y > doc.page.height - 80 && ri < rows.length - 1) {
				doc
					.rect(x, segmentStartY, PAGE_W, y - segmentStartY)
					.strokeColor('#cbd5e1')
					.lineWidth(0.5)
					.stroke();
				doc.addPage();
				y = 50;
				segmentStartY = y;
			}
			doc.rect(x, y, PAGE_W, rowH).fill(ri % 2 === 0 ? 'white' : '#f1f5f9');
			doc.fill('#1f2937').font('Helvetica').fontSize(7.5);
			cx = x + 4;
			row.forEach((cell, i) => {
				const color = cellColors?.[ri]?.[i];
				if (color) doc.fillColor(color);
				doc.text(fmt(cell), cx, y + 5, {
					width: colWidths[i] - 6,
					lineBreak: false,
					ellipsis: true
				});
				if (color) doc.fillColor('#1f2937');
				cx += colWidths[i];
			});
			y += rowH;
		});

		// Close the final border segment
		if (y > segmentStartY) {
			doc
				.rect(x, segmentStartY, PAGE_W, y - segmentStartY)
				.strokeColor('#cbd5e1')
				.lineWidth(0.5)
				.stroke();
		}

		return y + 12;
	}

	// Only add a page break if we're not already near the top of a fresh page.
	// Prevents the double-page scenario where the table's last row just added a
	// page and then the section check adds another one on top of it.
	function pageBreakIfNeeded(minSpace = 180) {
		if (doc.y > doc.page.height - minSpace) {
			doc.addPage();
		}
	}

	// ---- Cover / Title ----
	const headerGradient = doc.linearGradient(0, 0, doc.page.width, 0);
	headerGradient.stop(0, '#ffffff').stop(1, '#f0fdf4');
	doc.rect(0, 0, doc.page.width, 120).fill(headerGradient);
	const logoExists = fs.existsSync(logoPath);
	if (logoExists) {
		doc.image(logoPath, 50, 38, { width: 55 });
	}
	doc
		.fillColor('#1f2937')
		.font('Helvetica-Bold')
		.fontSize(24)
		.text(title ? title : 'Test', 50 + (logoExists ? 65 : 0), 38);
	doc
		.fontSize(10)
		.font('Helvetica')
		.fillColor('#4b5563')
		.text(`Generated: ${generatedAt}`, 50 + (logoExists ? 65 : 0), 66);
	if (Object.values(reports.appliedFilters).some(Boolean)) {
		const f = reports.appliedFilters;
		const parts = [
			f.dateFrom && `From: ${f.dateFrom}`,
			f.dateTo && `To: ${f.dateTo}`,
			f.architectId && `Architect filter active`,
			f.status && `Status: ${f.status}`,
			f.priority && `Priority: ${f.priority}`
		]
			.filter(Boolean)
			.join('  ·  ');
		doc.fillColor('#6b7280').fontSize(8).text(`Filters: ${parts}`, 50, 80);
	}
	doc.y = 140;

	// ---- Summary stat cards ----
	const totalProjects = reports.projectSummary.length;
	const completedProjects = reports.projectSummary.filter((p) => p.status === 'Completed').length;
	const totalTasks = reports.statusFunnel.reduce((s, r) => s + r.taskCount, 0);
	const overdueCount = reports.overdueTasks.length;
	const cardW = Math.floor(PAGE_W / 4) - 4;
	const cardY = doc.y;

	statCard('Total Projects', totalProjects, 50, cardY, cardW, BLUE);
	statCard('Completed Projects', completedProjects, 50 + cardW + 4, cardY, cardW, GREEN);
	statCard('Total Tasks', totalTasks, 50 + (cardW + 4) * 2, cardY, cardW, NAVY);
	statCard(
		'Overdue Tasks',
		overdueCount,
		50 + (cardW + 4) * 3,
		cardY,
		cardW,
		overdueCount > 0 ? RED : SLATE
	);
	doc.y = cardY + 60;

	// ---- Project Summary ----
	if ((section === 'all' || section === 'projects') && reports.projectSummary.length > 0) {
		pageBreakIfNeeded();
		heading('Project Status Summary');
		subtext(`${reports.projectSummary.length} projects`);
		const colW = [160, 78, 72, 65, 65, 55];
		const cellColors = reports.projectSummary.map((p) => [
			undefined,
			statusColor(p.status),
			priorityColor(p.priority),
			undefined,
			undefined,
			undefined
		]);
		const y = table(
			['Project', 'Status', 'Priority', 'Due Date', 'Tasks', 'Done %'],
			reports.projectSummary.map((p) => [
				p.projectName,
				p.status,
				p.priority,
				fmtDate(p.dueDate),
				fmt(p.totalTasks),
				`${p.completionRate}%`
			]),
			colW,
			doc.y,
			cellColors
		);
		doc.y = y;
	}

	// ---- Architect Workload ----
	if ((section === 'all' || section === 'architects') && reports.architectWorkload.length > 0) {
		pageBreakIfNeeded();
		heading('Architect Workload');
		subtext(`${reports.architectWorkload.length} architects`);
		const colW = [150, 52, 52, 58, 88, 95];
		const y = table(
			['Architect', 'Total', 'Active', 'Overdue', 'In Prog.', 'Completed'],
			reports.architectWorkload.map((a) => [
				a.architectName,
				fmt(a.totalTasks),
				fmt(a.activeTasks),
				fmt(a.overdueTasks),
				fmt(a.byStatus['In Progress']),
				fmt(a.byStatus['Completed'])
			]),
			colW,
			doc.y
		);
		doc.y = y;
	}

	// ---- Overdue Tasks ----
	if (section === 'all' || section === 'overdue') {
		pageBreakIfNeeded();
		heading('Overdue Tasks');
		if (reports.overdueTasks.length === 0) {
			doc.fontSize(9).font('Helvetica').fillColor(GREEN).text('✓ No overdue tasks.').moveDown();
		} else {
			subtext(`${reports.overdueTasks.length} tasks past their due date`);
			const colW = [145, 115, 100, 65, 70];
			const cellColors = reports.overdueTasks.map((t) => [
				undefined,
				undefined,
				undefined,
				priorityColor(t.priority),
				undefined
			]);
			const y = table(
				['Task', 'Project', 'Architect', 'Priority', 'Days Late'],
				reports.overdueTasks.map((t) => [
					t.taskName,
					t.projectName,
					t.architectName,
					t.priority,
					fmt(t.daysOverdue) + 'd'
				]),
				colW,
				doc.y,
				cellColors
			);
			doc.y = y;
		}
	}

	// ---- Footer (page numbers + branding) ----
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const totalPages = (doc as any).bufferedPageRange().count;
	for (let i = 0; i < totalPages; i++) {
		doc.switchToPage(i);
		doc
			.fontSize(7)
			.font('Helvetica')
			.fillColor(SLATE)
			.text('KDC Project Management', 50, doc.page.height - 30, {
				width: PAGE_W / 2,
				align: 'left'
			})
			.text(`Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 30, {
				align: 'right',
				width: PAGE_W
			});
	}

	doc.end();
	await new Promise<void>((resolve) => doc.on('end', resolve));
	return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET: RequestHandler = ({ url }) => {
	const format = url.searchParams.get('format') ?? 'csv';
	const section = url.searchParams.get('section') ?? 'all';
	const filters = extractFilters(url);

	return catchHandler(async () => {
		const reports = await getAllReports(filters);
		const ts = new Date().toISOString().split('T')[0];

		if (format === 'pdf') {
			const buffer = await buildPDF(reports, section);
			return new Response(buffer as BodyInit, {
				headers: {
					'Content-Type': 'application/pdf',
					'Content-Disposition': `attachment; filename="report-${ts}.pdf"`
				}
			});
		}

		const csv = buildCSV(reports, section);
		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="report-${ts}.csv"`
			}
		});
	}, 'Export failed');
};
