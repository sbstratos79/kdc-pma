// src/lib/server/db/repos/reports.repo.ts

import { db } from '$lib/server/db/queries/db';
import { projects, tasks, architects } from '$lib/server/db/schema';
import { STATUSES, PRIORITIES } from '$lib/server/db/schema';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface ReportFilters {
	/** ISO date string e.g. "2025-01-01" — filters by dueDate >= dateFrom */
	dateFrom?: string | null;
	/** ISO date string — filters by dueDate <= dateTo */
	dateTo?: string | null;
	/** Only include tasks (and projects with those tasks) for this architect */
	architectId?: string | null;
	/** Filter projects/tasks by status */
	status?: string | null;
	/** Filter projects/tasks by priority */
	priority?: string | null;
	/** Search term matching project/task/architect name */
	search?: string | null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectSummaryRow {
	projectId: string;
	projectName: string;
	status: string;
	priority: string;
	startDate: string | null;
	dueDate: string | null;
	addedTime: string | null;
	totalTasks: number;
	completedTasks: number;
	overdueTasks: number;
	completionRate: number;
	isOverdue: boolean;
}

export interface ArchitectWorkloadRow {
	architectId: string;
	architectName: string;
	totalTasks: number;
	activeTasks: number;
	overdueTasks: number;
	byStatus: Record<string, number>;
	byPriority: Record<string, number>;
}

export interface OverdueTaskRow {
	taskId: string;
	taskName: string;
	status: string;
	priority: string;
	dueDate: string;
	daysOverdue: number;
	projectId: string;
	projectName: string;
	architectId: string | null;
	architectName: string;
}

export interface StatusFunnelRow {
	status: string;
	projectCount: number;
	taskCount: number;
}

export interface PriorityDistributionRow {
	priority: string;
	projectCount: number;
	taskCount: number;
}

export interface AllReports {
	projectSummary: ProjectSummaryRow[];
	architectWorkload: ArchitectWorkloadRow[];
	overdueTasks: OverdueTaskRow[];
	statusFunnel: StatusFunnelRow[];
	priorityDistribution: PriorityDistributionRow[];
	appliedFilters: ReportFilters;
	generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
	return new Date().toISOString().split('T')[0];
}

function daysOverdue(dueDateIso: string): number {
	const due = new Date(dueDateIso).getTime();
	const now = new Date().setHours(0, 0, 0, 0);
	return Math.floor((now - due) / 86_400_000);
}

function inDateRange(dueDate: string | null | undefined, from?: string | null, to?: string | null): boolean {
	if (!from && !to) return true;
	if (!dueDate) return true;
	if (from && dueDate < from) return false;
	if (to && dueDate > to) return false;
	return true;
}

// ---------------------------------------------------------------------------
// Report queries
// ---------------------------------------------------------------------------

export async function getProjectStatusSummary(filters: ReportFilters = {}): Promise<ProjectSummaryRow[]> {
	const [allProjects, allTasks] = await Promise.all([
		db.select().from(projects),
		db.select().from(tasks)
	]);

	const today = todayIso();

	let filteredProjects = allProjects
		.filter(
			(p) =>
				!filters.search ||
				p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
				(p.description ?? '').toLowerCase().includes(filters.search.toLowerCase())
		)
		.filter((p) => !filters.status || p.status === filters.status)
		.filter((p) => !filters.priority || p.priority === filters.priority)
		.filter((p) => inDateRange(p.dueDate, filters.dateFrom, filters.dateTo));

	let filteredTasks = allTasks
		.filter(
			(t) =>
				!filters.search ||
				t.name.toLowerCase().includes(filters.search.toLowerCase()) ||
				(t.description ?? '').toLowerCase().includes(filters.search.toLowerCase())
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

export async function getArchitectWorkload(filters: ReportFilters = {}): Promise<ArchitectWorkloadRow[]> {
	const [allArchitects, allTasks] = await Promise.all([
		db.select().from(architects),
		db.select().from(tasks)
	]);

	const today = todayIso();

	let filteredArchitects = allArchitects
		.filter((a) => !filters.search || a.name.toLowerCase().includes(filters.search.toLowerCase()));
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
			overdueTasks: at.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'Completed').length,
			byStatus,
			byPriority
		};
	});
}

export async function getOverdueTasks(filters: ReportFilters = {}): Promise<OverdueTaskRow[]> {
	const today = todayIso();
	const [allTasks, allProjects, allArchitects] = await Promise.all([
		db.select().from(tasks),
		db.select().from(projects),
		db.select().from(architects)
	]);

	const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));
	const architectMap = new Map(allArchitects.map((a) => [a.id, a.name]));

	return allTasks
		.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'Completed' && t.status !== 'Cancelled')
		.filter(
			(t) =>
				!filters.search ||
				t.name.toLowerCase().includes(filters.search.toLowerCase()) ||
				(projectMap.get(t.projectId) ?? '').toLowerCase().includes(filters.search.toLowerCase()) ||
				(t.architectId && (architectMap.get(t.architectId) ?? '').toLowerCase().includes(filters.search.toLowerCase()))
		)
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

export async function getStatusAndPriorityBreakdown(filters: ReportFilters = {}): Promise<{
	statusFunnel: StatusFunnelRow[];
	priorityDistribution: PriorityDistributionRow[];
}> {
	const [allProjects, allTasks] = await Promise.all([
		db.select().from(projects),
		db.select().from(tasks)
	]);

	const filteredProjects = allProjects
		.filter(
			(p) =>
				!filters.search ||
				p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
				(p.description ?? '').toLowerCase().includes(filters.search.toLowerCase())
		)
		.filter((p) => !filters.priority || p.priority === filters.priority)
		.filter((p) => inDateRange(p.dueDate, filters.dateFrom, filters.dateTo));

	const filteredTasks = allTasks
		.filter(
			(t) =>
				!filters.search ||
				t.name.toLowerCase().includes(filters.search.toLowerCase()) ||
				(t.description ?? '').toLowerCase().includes(filters.search.toLowerCase())
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

export async function getAllReports(filters: ReportFilters = {}): Promise<AllReports> {
	const [projectSummary, architectWorkload, overdueTasks, breakdown] = await Promise.all([
		getProjectStatusSummary(filters),
		getArchitectWorkload(filters),
		getOverdueTasks(filters),
		getStatusAndPriorityBreakdown(filters)
	]);

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
