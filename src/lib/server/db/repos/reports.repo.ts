// src/lib/server/db/repos/reports.repo.ts

import { db } from '$lib/server/db/queries/db';
import { projects, tasks, architects } from '$lib/server/db/schema';
import { STATUSES, PRIORITIES } from '$lib/server/db/schema';
import type {
	ReportFilters,
	ProjectSummaryRow,
	ArchitectWorkloadRow,
	OverdueTaskRow,
	StatusFunnelRow,
	PriorityDistributionRow,
	AllReports
} from '$lib/types';

export type {
	ReportFilters,
	ProjectSummaryRow,
	ArchitectWorkloadRow,
	OverdueTaskRow,
	StatusFunnelRow,
	PriorityDistributionRow,
	AllReports
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ProjectRow = typeof projects.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type ArchitectRow = typeof architects.$inferSelect;

function todayIso(): string {
	return new Date().toISOString().split('T')[0];
}

function daysOverdue(dueDateIso: string): number {
	const due = new Date(dueDateIso).getTime();
	const now = new Date().setHours(0, 0, 0, 0);
	return Math.floor((now - due) / 86_400_000);
}

function inDateRange(
	dateVal: string | null | undefined,
	from?: string | null,
	to?: string | null
): boolean {
	if (!from && !to) return true;
	if (!dateVal) return true;
	const d = dateVal.split('T')[0].split(' ')[0];
	if (from && d < from) return false;
	if (to && d > to) return false;
	return true;
}

function matchesSearch(value: string, search: string): boolean {
	return value.toLowerCase().includes(search.toLowerCase());
}

// ---------------------------------------------------------------------------
// Internal: operate on pre-loaded data (used by getAllReports)
// ---------------------------------------------------------------------------

function getProjectStatusSummaryFromData(
	allProjects: ProjectRow[],
	allTasks: TaskRow[],
	filters: ReportFilters
): ProjectSummaryRow[] {
	const today = todayIso();
	const search = filters.search ?? '';

	let filteredProjects = allProjects
		.filter(
			(p) => !search || matchesSearch(p.name, search) || matchesSearch(p.description ?? '', search)
		)
		.filter((p) => !filters.status || p.status === filters.status)
		.filter((p) => !filters.priority || p.priority === filters.priority)
		.filter((p) => inDateRange(p.dueDate, filters.dateFrom, filters.dateTo));

	const filteredTasks = allTasks
		.filter(
			(t) => !search || matchesSearch(t.name, search) || matchesSearch(t.description ?? '', search)
		)
		.filter((t) => !filters.architectId || t.architectId === filters.architectId)
		.filter((t) => inDateRange(t.dueDate, filters.dateFrom, filters.dateTo));

	if (filters.architectId) {
		const projectIdsWithArch = new Set(filteredTasks.map((t) => t.projectId));
		filteredProjects = filteredProjects.filter((p) => projectIdsWithArch.has(p.id));
	}

	return filteredProjects.map((p) => {
		const pt = filteredTasks.filter((t) => t.projectId === p.id);
		const completed = pt.filter((t) => t.status === 'Completed').length;
		const overdue = pt.filter(
			(t) => t.dueDate && t.dueDate < today && t.status !== 'Completed'
		).length;
		const total = pt.length;

		return {
			projectId: p.id,
			projectName: p.name,
			status: p.status,
			priority: p.priority,
			startDate: p.startDate ?? null,
			dueDate: p.dueDate ?? null,
			addedTime: p.addedTime ?? null,
			totalTasks: total,
			completedTasks: completed,
			overdueTasks: overdue,
			completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
			isOverdue: Boolean(p.dueDate && p.dueDate < today && p.status !== 'Completed')
		};
	});
}

function getArchitectWorkloadFromData(
	allArchitects: ArchitectRow[],
	allTasks: TaskRow[],
	filters: ReportFilters
): ArchitectWorkloadRow[] {
	const today = todayIso();
	const search = filters.search ?? '';

	let filteredArchitects = allArchitects.filter((a) => !search || matchesSearch(a.name, search));
	if (filters.architectId) {
		filteredArchitects = filteredArchitects.filter((a) => a.id === filters.architectId);
	}

	const filteredTasks = allTasks
		.filter((t) => !filters.priority || t.priority === filters.priority)
		.filter((t) => !filters.status || t.status === filters.status)
		.filter((t) => inDateRange(t.dueDate, filters.dateFrom, filters.dateTo));

	return filteredArchitects.map((a) => {
		const at = filteredTasks.filter((t) => t.architectId === a.id);
		const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
		const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<string, number>;
		for (const t of at) {
			if (t.status in byStatus) byStatus[t.status]++;
			if (t.priority in byPriority) byPriority[t.priority]++;
		}
		return {
			architectId: a.id,
			architectName: a.name,
			totalTasks: at.length,
			activeTasks: at.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled').length,
			overdueTasks: at.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'Completed')
				.length,
			byStatus,
			byPriority
		};
	});
}

function getOverdueTasksFromData(
	allTasks: TaskRow[],
	allProjects: ProjectRow[],
	allArchitects: ArchitectRow[],
	filters: ReportFilters
): OverdueTaskRow[] {
	const today = todayIso();
	const search = filters.search ?? '';

	const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));
	const architectMap = new Map(allArchitects.map((a) => [a.id, a.name]));

	return allTasks
		.filter(
			(t) => t.dueDate && t.dueDate < today && t.status !== 'Completed' && t.status !== 'Cancelled'
		)
		.filter(
			(t) =>
				!search ||
				matchesSearch(t.name, search) ||
				matchesSearch(projectMap.get(t.projectId) ?? '', search) ||
				(t.architectId && matchesSearch(architectMap.get(t.architectId) ?? '', search))
		)
		.filter((t) => !filters.status || t.status === filters.status)
		.filter((t) => !filters.architectId || t.architectId === filters.architectId)
		.filter((t) => !filters.priority || t.priority === filters.priority)
		.filter((t) => inDateRange(t.dueDate, filters.dateFrom, filters.dateTo))
		.map((t) => ({
			taskId: t.id,
			taskName: t.name,
			status: t.status,
			priority: t.priority,
			dueDate: t.dueDate!,
			daysOverdue: daysOverdue(t.dueDate!),
			projectId: t.projectId,
			projectName: projectMap.get(t.projectId) ?? 'Unknown',
			architectId: t.architectId ?? null,
			architectName: t.architectId ? (architectMap.get(t.architectId) ?? 'Unknown') : 'Unassigned'
		}))
		.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

function getStatusAndPriorityBreakdownFromData(
	allProjects: ProjectRow[],
	allTasks: TaskRow[],
	filters: ReportFilters
): { statusFunnel: StatusFunnelRow[]; priorityDistribution: PriorityDistributionRow[] } {
	const search = filters.search ?? '';

	const filteredProjects = allProjects
		.filter(
			(p) => !search || matchesSearch(p.name, search) || matchesSearch(p.description ?? '', search)
		)
		.filter((p) => !filters.priority || p.priority === filters.priority)
		.filter((p) => inDateRange(p.dueDate, filters.dateFrom, filters.dateTo));

	const filteredTasks = allTasks
		.filter(
			(t) => !search || matchesSearch(t.name, search) || matchesSearch(t.description ?? '', search)
		)
		.filter((t) => !filters.architectId || t.architectId === filters.architectId)
		.filter((t) => !filters.priority || t.priority === filters.priority)
		.filter((t) => inDateRange(t.dueDate, filters.dateFrom, filters.dateTo));

	const statusFunnel: StatusFunnelRow[] = STATUSES.map((s) => ({
		status: s,
		projectCount: filteredProjects.filter((p) => p.status === s).length,
		taskCount: filteredTasks.filter((t) => t.status === s).length
	}));

	const priorityDistribution: PriorityDistributionRow[] = PRIORITIES.map((p) => ({
		priority: p,
		projectCount: filteredProjects.filter((proj) => proj.priority === p).length,
		taskCount: filteredTasks.filter((t) => t.priority === p).length
	}));

	return { statusFunnel, priorityDistribution };
}

// ---------------------------------------------------------------------------
// Public API: standalone functions (fetch own data)
// ---------------------------------------------------------------------------

export async function getProjectStatusSummary(
	filters: ReportFilters = {}
): Promise<ProjectSummaryRow[]> {
	const [allProjects, allTasks] = await Promise.all([
		db.select().from(projects),
		db.select().from(tasks)
	]);
	return getProjectStatusSummaryFromData(allProjects, allTasks, filters);
}

export async function getArchitectWorkload(
	filters: ReportFilters = {}
): Promise<ArchitectWorkloadRow[]> {
	const [allArchitects, allTasks] = await Promise.all([
		db.select().from(architects),
		db.select().from(tasks)
	]);
	return getArchitectWorkloadFromData(allArchitects, allTasks, filters);
}

export async function getOverdueTasks(filters: ReportFilters = {}): Promise<OverdueTaskRow[]> {
	const [allTasks, allProjects, allArchitects] = await Promise.all([
		db.select().from(tasks),
		db.select().from(projects),
		db.select().from(architects)
	]);
	return getOverdueTasksFromData(allTasks, allProjects, allArchitects, filters);
}

export async function getStatusAndPriorityBreakdown(filters: ReportFilters = {}): Promise<{
	statusFunnel: StatusFunnelRow[];
	priorityDistribution: PriorityDistributionRow[];
}> {
	const [allProjects, allTasks] = await Promise.all([
		db.select().from(projects),
		db.select().from(tasks)
	]);
	return getStatusAndPriorityBreakdownFromData(allProjects, allTasks, filters);
}

export async function getAllReports(filters: ReportFilters = {}): Promise<AllReports> {
	const [allProjects, allTasks, allArchitects] = await Promise.all([
		db.select().from(projects),
		db.select().from(tasks),
		db.select().from(architects)
	]);

	const projectSummary = getProjectStatusSummaryFromData(allProjects, allTasks, filters);
	const architectWorkload = getArchitectWorkloadFromData(allArchitects, allTasks, filters);
	const overdueTasks = getOverdueTasksFromData(allTasks, allProjects, allArchitects, filters);
	const breakdown = getStatusAndPriorityBreakdownFromData(allProjects, allTasks, filters);

	return {
		projectSummary,
		architectWorkload,
		overdueTasks,
		statusFunnel: breakdown.statusFunnel,
		priorityDistribution: breakdown.priorityDistribution,
		appliedFilters: filters,
		generatedAt: new Date().toISOString()
	};
}
