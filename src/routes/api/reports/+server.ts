// src/routes/api/reports/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { catchHandler, extractFilters } from '$lib/server/api-utils';
import {
	getAllReports,
	getProjectStatusSummary,
	getArchitectWorkload,
	getOverdueTasks,
	getStatusAndPriorityBreakdown
} from '$lib/server/db/repos/reports.repo';

export const GET: RequestHandler = ({ url }) => {
	const type = url.searchParams.get('type') ?? 'all';
	const filters = extractFilters(url);

	return catchHandler(async () => {
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
	}, `Failed to fetch report data (type=${type})`);
};
