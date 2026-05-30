// src/lib/types.ts

export interface Task {
	architectId: string | null;
	architectName: string;
	taskId: string;
	taskName: string;
	taskDescription: string | null;
	taskStartDate: string | null;
	taskDueDate: string | null;
	addedTime: string | null;
	taskStatus: string;
	taskPriority: string;
	projectId: string;
	projectName: string;
}

export interface Project {
	projectId: string;
	projectName: string;
	projectDescription: string | null;
	projectStartDate: string | null;
	projectDueDate: string | null;
	addedTime: string | null;
	projectStatus: string;
	projectPriority: string;
	tasks: Task[];
}

export interface Architect {
	architectId: string;
	architectName: string;
	tasks: Task[];
}

// ---------------------------------------------------------------------------
// Report types (shared between server repo and client components)
// ---------------------------------------------------------------------------

export interface ReportFilters {
	/** ISO date string e.g. "2025-01-01" — filters by addedTime >= dateFrom */
	dateFrom?: string | null;
	/** ISO date string — filters by addedTime <= dateTo */
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
