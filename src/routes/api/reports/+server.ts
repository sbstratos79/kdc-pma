// src/routes/api/reports/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { ReportFilters } from '$lib/server/db/repos/reports.repo';
import {
	getAllReports,
	getProjectStatusSummary,
	getArchitectWorkload,
	getOverdueTasks,
	getStatusAndPriorityBreakdown
} from '$lib/server/db/repos/reports.repo';

function extractFilters(url: URL): ReportFilters {
	return {
		dateFrom: url.searchParams.get('dateFrom') || null,
		dateTo: url.searchParams.get('dateTo') || null,
		architectId: url.searchParams.get('architectId') || null,
		status: url.searchParams.get('status') || null,
		priority: url.searchParams.get('priority') || null
	};
}

// GET /api/reports?type=all&dateFrom=2025-01-01&dateTo=2025-12-31&architectId=xxx&status=xxx&priority=xxx
export const GET: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type') ?? 'all';
	const filters = extractFilters(url);

	try {
		switch (type) {
			case 'project-summary':
				return json({ data: await getProjectStatusSummary(filters) });

			case 'architect-workload':
				return json({ data: await getArchitectWorkload(filters) });

			case 'overdue-tasks':
				return json({ data: await getOverdueTasks(filters) });

			case 'status-funnel': {
				const { statusFunnel } = await getStatusAndPriorityBreakdown(filters);
				return json({ data: statusFunnel });
			}

			case 'priority-distribution': {
				const { priorityDistribution } = await getStatusAndPriorityBreakdown(filters);
				return json({ data: priorityDistribution });
			}

			case 'all':
			default:
				return json({ data: await getAllReports(filters) });
		}
	} catch (err) {
		console.error(`GET /api/reports?type=${type} error`, err);
		return json({ error: 'Failed to fetch report data' }, { status: 500 });
	}
};
