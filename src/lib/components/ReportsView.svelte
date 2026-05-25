<!-- src/lib/components/ReportsView.svelte -->
<!--
  Dependencies: npm install chart.js pdfkit @types/pdfkit
-->

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Willow, DatePicker, RichSelect } from 'wx-svelte-core';
	import { Grid } from 'wx-svelte-grid';
	import { formatDate } from '$lib/utils/dateUtils';
	import Chart from 'chart.js/auto';

	// ---------------------------------------------------------------------------
	// Types (client-side mirror of reports.repo.ts — no server imports on client)
	// ---------------------------------------------------------------------------
	interface ProjectSummaryRow {
		projectId: string;
		projectName: string;
		status: string;
		priority: string;
		startDate: string | null;
		dueDate: string | null;
		totalTasks: number;
		completedTasks: number;
		overdueTasks: number;
		completionRate: number;
		isOverdue: boolean;
	}
	interface ArchitectWorkloadRow {
		architectId: string;
		architectName: string;
		totalTasks: number;
		activeTasks: number;
		overdueTasks: number;
		byStatus: Record<string, number>;
		byPriority: Record<string, number>;
	}
	interface OverdueTaskRow {
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
	interface StatusFunnelRow {
		status: string;
		projectCount: number;
		taskCount: number;
	}
	interface PriorityDistRow {
		priority: string;
		projectCount: number;
		taskCount: number;
	}
	interface AllReports {
		projectSummary: ProjectSummaryRow[];
		architectWorkload: ArchitectWorkloadRow[];
		overdueTasks: OverdueTaskRow[];
		statusFunnel: StatusFunnelRow[];
		priorityDistribution: PriorityDistRow[];
		appliedFilters: Record<string, string | null>;
		generatedAt: string;
	}

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let loading = $state(true);
	let exporting = $state<'pdf' | 'csv' | null>(null);
	let error = $state<string | null>(null);
	let reports = $state<AllReports | null>(null);
	let activeTab = $state<'overview' | 'projects' | 'architects' | 'overdue'>('overview');
	let filtersOpen = $state(true);

	// Filter state
	let dateFrom = $state<Date | null>(null);
	let dateTo = $state<Date | null>(null);
	let architectId = $state<string>('all');
	let statusFilter = $state<string>('all');
	let priorityFilter = $state<string>('all');

	// Architect list for the dropdown
	let architectOptions = $state<Array<{ id: string; label: string }>>([
		{ id: 'all', label: 'All Architects' }
	]);

	// Enum options
	const statusOptions = [
		{ id: 'all', label: 'All Statuses' },
		{ id: 'Planning', label: 'Planning' },
		{ id: 'In Progress', label: 'In Progress' },
		{ id: 'Completed', label: 'Completed' },
		{ id: 'On Hold', label: 'On Hold' },
		{ id: 'Cancelled', label: 'Cancelled' }
	];
	const priorityOptions = [
		{ id: 'all', label: 'All Priorities' },
		{ id: 'High', label: 'High' },
		{ id: 'Medium', label: 'Medium' },
		{ id: 'Low', label: 'Low' }
	];

	// Tabs definition
	const tabs: Array<[string, string]> = [
		['overview', 'Overview'],
		['projects', 'Project Summary'],
		['architects', 'Architect Workload'],
		['overdue', 'Overdue Tasks']
	];

	// ---------------------------------------------------------------------------
	// Derived summary metrics
	// ---------------------------------------------------------------------------
	let totalProjects = $derived(reports?.projectSummary.length ?? 0);
	let totalTasks = $derived(reports?.statusFunnel.reduce((s, r) => s + r.taskCount, 0) ?? 0);
	let overdueCount = $derived(reports?.overdueTasks.length ?? 0);
	let completedProjects = $derived(
		reports?.projectSummary.filter((p) => p.status === 'Completed').length ?? 0
	);
	let hasActiveFilters = $derived(
		dateFrom !== null ||
			dateTo !== null ||
			architectId !== 'all' ||
			statusFilter !== 'all' ||
			priorityFilter !== 'all'
	);

	// ---------------------------------------------------------------------------
	// Chart canvases
	// ---------------------------------------------------------------------------
	let statusCanvas = $state<HTMLCanvasElement | null>(null);
	let priorityCanvas = $state<HTMLCanvasElement | null>(null);
	let workloadCanvas = $state<HTMLCanvasElement | null>(null);
	let statusChart: Chart | null = null;
	let priorityChart: Chart | null = null;
	let workloadChart: Chart | null = null;

	const STATUS_COLORS: Record<string, string> = {
		Planning: '#94a3b8',
		'In Progress': '#3b82f6',
		Completed: '#22c55e',
		'On Hold': '#f59e0b',
		Cancelled: '#ef4444'
	};
	const PRIORITY_COLORS: Record<string, string> = {
		High: '#ef4444',
		Medium: '#f59e0b',
		Low: '#22c55e'
	};

	function chartDefaults() {
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } }
			},
			scales: {
				x: { grid: { display: false }, ticks: { font: { size: 10 } } },
				y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } }
			}
		};
	}

	$effect(() => {
		if (!statusCanvas || !reports) return;
		statusChart?.destroy();
		const labels = reports.statusFunnel.map((r) => r.status);
		statusChart = new Chart(statusCanvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Projects',
						data: reports.statusFunnel.map((r) => r.projectCount),
						backgroundColor: labels.map((l) => STATUS_COLORS[l] + '88'),
						borderColor: labels.map((l) => STATUS_COLORS[l]),
						borderWidth: 1.5,
						borderRadius: 4
					},
					{
						label: 'Tasks',
						data: reports.statusFunnel.map((r) => r.taskCount),
						backgroundColor: labels.map((l) => STATUS_COLORS[l]),
						borderColor: labels.map((l) => STATUS_COLORS[l]),
						borderWidth: 1.5,
						borderRadius: 4
					}
				]
			},
			options: {
				...chartDefaults(),
				plugins: { ...chartDefaults().plugins, title: { display: false } }
			}
		});
		return () => {
			statusChart?.destroy();
			statusChart = null;
		};
	});

	$effect(() => {
		if (!priorityCanvas || !reports) return;
		priorityChart?.destroy();
		const labels = reports.priorityDistribution.map((r) => r.priority);
		priorityChart = new Chart(priorityCanvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						data: reports.priorityDistribution.map((r) => r.taskCount),
						backgroundColor: labels.map((l) => PRIORITY_COLORS[l]),
						borderWidth: 2,
						borderColor: 'white',
						hoverOffset: 6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
					tooltip: {
						callbacks: {
							label: (ctx) => {
								const r = reports!.priorityDistribution[ctx.dataIndex];
								return ` ${r.priority}: ${r.taskCount} tasks, ${r.projectCount} projects`;
							}
						}
					}
				}
			}
		});
		return () => {
			priorityChart?.destroy();
			priorityChart = null;
		};
	});

	$effect(() => {
		if (!workloadCanvas || !reports) return;
		workloadChart?.destroy();
		const sorted = [...reports.architectWorkload]
			.sort((a, b) => b.activeTasks - a.activeTasks)
			.slice(0, 10);
		workloadChart = new Chart(workloadCanvas, {
			type: 'bar',
			data: {
				labels: sorted.map((a) => a.architectName),
				datasets: [
					{
						label: 'Active',
						data: sorted.map((a) => a.activeTasks),
						backgroundColor: '#3b82f6',
						borderRadius: 4
					},
					{
						label: 'Overdue',
						data: sorted.map((a) => a.overdueTasks),
						backgroundColor: '#ef4444',
						borderRadius: 4
					}
				]
			},
			options: {
				...chartDefaults(),
				indexAxis: 'y' as const,
				scales: {
					x: { beginAtZero: true, stacked: false, ticks: { precision: 0, font: { size: 10 } } },
					y: { grid: { display: false }, ticks: { font: { size: 10 } } }
				}
			}
		});
		return () => {
			workloadChart?.destroy();
			workloadChart = null;
		};
	});

	// ---------------------------------------------------------------------------
	// Data fetching
	// ---------------------------------------------------------------------------
	function buildQueryString(extra?: Record<string, string>): string {
		const p = new URLSearchParams();
		if (dateFrom) p.set('dateFrom', dateFrom.toISOString().split('T')[0]);
		if (dateTo) p.set('dateTo', dateTo.toISOString().split('T')[0]);
		if (architectId !== 'all') p.set('architectId', architectId);
		if (statusFilter !== 'all') p.set('status', statusFilter);
		if (priorityFilter !== 'all') p.set('priority', priorityFilter);
		if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
		return p.toString();
	}

	async function loadReports() {
		loading = true;
		error = null;
		try {
			const qs = buildQueryString({ type: 'all' });
			const res = await fetch(`/api/reports?${qs}`);
			const json = await res.json();
			if (json.error) throw new Error(json.error);
			reports = json.data;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load reports';
		} finally {
			loading = false;
		}
	}

	async function loadArchitects() {
		try {
			const res = await fetch('/api/architects');
			const json = await res.json();
			if (json.data) {
				architectOptions = [
					{ id: 'all', label: 'All Architects' },
					...json.data.map((a: any) => ({
						id: a.architectId ?? a.id,
						label: a.architectName ?? a.name
					}))
				];
			}
		} catch {
			/* non-fatal */
		}
	}

	function resetFilters() {
		dateFrom = null;
		dateTo = null;
		architectId = 'all';
		statusFilter = 'all';
		priorityFilter = 'all';
		loadReports();
	}

	onMount(async () => {
		await Promise.all([loadArchitects(), loadReports()]);
	});

	// ---------------------------------------------------------------------------
	// Export
	// ---------------------------------------------------------------------------
	async function exportReport(format: 'pdf' | 'csv') {
		exporting = format;
		try {
			const section =
				activeTab === 'overview'
					? 'all'
					: activeTab === 'projects'
						? 'projects'
						: activeTab === 'architects'
							? 'architects'
							: 'overdue';
			const qs = buildQueryString({ format, section });
			const res = await fetch(`/api/reports/export?${qs}`);
			if (!res.ok) throw new Error('Export failed');
			const blob = await res.blob();
			const ts = new Date().toISOString().split('T')[0];
			const ext = format === 'pdf' ? 'pdf' : 'csv';
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `report-${ts}.${ext}`;
			a.click();
			URL.revokeObjectURL(a.href);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Export failed');
		} finally {
			exporting = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Grid columns
	// ---------------------------------------------------------------------------
	const projectColumns = [
		{ id: 'projectName', header: 'Project', width: 200, flexgrow: 1 },
		{ id: 'status', header: 'Status', width: 110, sort: true },
		{ id: 'priority', header: 'Priority', width: 90, sort: true },
		{ id: 'startDate', header: 'Start', width: 105, template: formatDate, sort: true },
		{ id: 'dueDate', header: 'Due', width: 105, template: formatDate, sort: true },
		{ id: 'totalTasks', header: 'Tasks', width: 65, sort: true },
		{
			id: 'completionRate',
			header: 'Done %',
			width: 75,
			sort: true,
			template: (v: number) => `${v}%`
		},
		{
			id: 'overdueTasks',
			header: 'Overdue',
			width: 80,
			sort: true,
			template: (v: number) => (v > 0 ? `⚠ ${v}` : '—')
		}
	];
	const architectColumns = [
		{ id: 'architectName', header: 'Architect', width: 180, flexgrow: 1 },
		{ id: 'totalTasks', header: 'Total', width: 65, sort: true },
		{ id: 'activeTasks', header: 'Active', width: 70, sort: true },
		{
			id: 'overdueTasks',
			header: 'Overdue',
			width: 80,
			sort: true,
			template: (v: number) => (v > 0 ? `⚠ ${v}` : '—')
		},
		{
			id: 'byStatus',
			header: 'In Progress',
			width: 100,
			template: (v: Record<string, number>) => String(v['In Progress'] ?? 0),
			sort: true
		},
		{
			id: 'byPriority',
			header: 'High Priority',
			width: 105,
			template: (v: Record<string, number>) => String(v['High'] ?? 0),
			sort: true
		}
	];
	const overdueColumns = [
		{ id: 'taskName', header: 'Task', width: 200, flexgrow: 1 },
		{ id: 'projectName', header: 'Project', width: 150 },
		{ id: 'architectName', header: 'Architect', width: 130 },
		{ id: 'status', header: 'Status', width: 105 },
		{ id: 'priority', header: 'Priority', width: 85, sort: true },
		{ id: 'dueDate', header: 'Was Due', width: 105, template: formatDate, sort: true },
		{
			id: 'daysOverdue',
			header: 'Days Late',
			width: 85,
			sort: true,
			template: (v: number) => `${v}d`
		}
	];
</script>

<Willow>
	<div class="reports-root">
		<!-- ── Header ─────────────────────────────────────────────────── -->
		<div class="mb-5 flex items-center justify-between">
			<h2 class="text-2xl font-bold text-gray-800">Reports</h2>
			<div class="flex gap-2">
				<button
					class="export-btn"
					onclick={() => exportReport('csv')}
					disabled={loading || exporting !== null}
				>
					{exporting === 'csv' ? 'Exporting…' : '↓ CSV'}
				</button>
				<button
					class="export-btn export-btn--pdf"
					onclick={() => exportReport('pdf')}
					disabled={loading || exporting !== null}
				>
					{exporting === 'pdf' ? 'Exporting…' : '↓ PDF'}
				</button>
				<button class="refresh-btn" onclick={loadReports} disabled={loading}>
					{loading ? 'Loading…' : '↻ Refresh'}
				</button>
			</div>
		</div>

		<!-- ── Filters ─────────────────────────────────────────────────── -->
		<div class="filter-panel mb-5">
			<button class="filter-toggle" onclick={() => (filtersOpen = !filtersOpen)}>
				<span class="filter-toggle__label">
					⚙ Filters
					{#if hasActiveFilters}<span class="filter-badge">active</span>{/if}
				</span>
				<span class="filter-toggle__caret">{filtersOpen ? '▲' : '▼'}</span>
			</button>

			{#if filtersOpen}
				<div class="filter-body">
					<div class="filter-row">
						<div class="filter-field">
							<label class="filter-label">From Date</label>
							<DatePicker bind:value={dateFrom} clear placeholder="Any start" />
						</div>
						<div class="filter-field">
							<label class="filter-label">To Date</label>
							<DatePicker bind:value={dateTo} clear placeholder="Any end" />
						</div>
						<div class="filter-field">
							<label class="filter-label">Architect</label>
							<RichSelect options={architectOptions} bind:value={architectId} clear />
						</div>
						<div class="filter-field">
							<label class="filter-label">Status</label>
							<RichSelect options={statusOptions} bind:value={statusFilter} clear />
						</div>
						<div class="filter-field">
							<label class="filter-label">Priority</label>
							<RichSelect options={priorityOptions} bind:value={priorityFilter} clear />
						</div>
					</div>
					<div class="filter-actions">
						<button class="btn-apply" onclick={loadReports} disabled={loading}>
							Apply Filters
						</button>
						{#if hasActiveFilters}
							<button class="btn-reset" onclick={resetFilters}> ✕ Reset </button>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		{#if error}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
				Error: {error}
			</div>
		{/if}

		{#if !loading && reports}
			<!-- ── Summary Cards ──────────────────────────────────────────── -->
			<div class="stat-cards mb-5">
				<div class="stat-card stat-card--blue">
					<div class="stat-value">{totalProjects}</div>
					<div class="stat-label">Total Projects</div>
				</div>
				<div class="stat-card stat-card--green">
					<div class="stat-value">{completedProjects}</div>
					<div class="stat-label">Completed</div>
				</div>
				<div class="stat-card stat-card--slate">
					<div class="stat-value">{totalTasks}</div>
					<div class="stat-label">Total Tasks</div>
				</div>
				<div class="stat-card {overdueCount > 0 ? 'stat-card--red' : 'stat-card--gray'}">
					<div class="stat-value">{overdueCount}</div>
					<div class="stat-label">Overdue Tasks</div>
				</div>
			</div>

			<!-- ── Tabs ──────────────────────────────────────────────────── -->
			<div class="tabs mb-4">
				{#each tabs as tab}
					<button
						class="tab {activeTab === tab[0] ? 'tab--active' : ''}"
						onclick={() => (activeTab = tab[0] as typeof activeTab)}
					>
						{tab[1]}{tab[0] === 'overdue' && overdueCount > 0 ? ` (${overdueCount})` : ''}
					</button>
				{/each}
			</div>

			<!-- ── Tab: Overview ─────────────────────────────────────────── -->
			{#if activeTab === 'overview'}
				<div class="overview-grid">
					<!-- Status chart -->
					<div class="chart-card chart-card--wide">
						<h3 class="chart-title">Status Distribution</h3>
						<p class="chart-sub">
							Projects vs. tasks per status — lighter bars are projects, solid are tasks
						</p>
						<div class="chart-area">
							<canvas bind:this={statusCanvas}></canvas>
						</div>
					</div>

					<!-- Priority doughnut -->
					<div class="chart-card">
						<h3 class="chart-title">Task Priority Mix</h3>
						<p class="chart-sub">Distribution of tasks by priority level</p>
						<div class="chart-area">
							<canvas bind:this={priorityCanvas}></canvas>
						</div>
					</div>

					<!-- Architect workload -->
					<div class="chart-card chart-card--wide">
						<h3 class="chart-title">Architect Workload <span class="chart-note">(top 10)</span></h3>
						<p class="chart-sub">Active tasks vs. overdue tasks per architect</p>
						<div class="chart-area chart-area--tall">
							<canvas bind:this={workloadCanvas}></canvas>
						</div>
					</div>

					<!-- Overdue preview -->
					{#if reports.overdueTasks.length > 0}
						<div class="overdue-preview">
							<h3 class="chart-title text-red-700">⚠ Most Overdue Tasks</h3>
							<div class="mt-3 space-y-2">
								{#each reports.overdueTasks.slice(0, 5) as task}
									<div class="overdue-row">
										<div class="overdue-left">
											<span class="font-medium text-gray-800">{task.taskName}</span>
											<span class="ml-2 text-xs text-gray-400">{task.projectName}</span>
										</div>
										<div class="overdue-right">
											<span class="text-xs text-gray-500">{task.architectName}</span>
											<span class="overdue-badge">{task.daysOverdue}d late</span>
										</div>
									</div>
								{/each}
							</div>
							{#if reports.overdueTasks.length > 5}
								<button
									class="mt-3 text-xs text-red-600 underline"
									onclick={() => (activeTab = 'overdue')}
								>
									View all {reports.overdueTasks.length} overdue tasks →
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- ── Tab: Project Summary ───────────────────────────────────── -->
			{:else if activeTab === 'projects'}
				{#if reports.projectSummary.length === 0}
					<div class="empty-state">No projects match the current filters.</div>
				{:else}
					<div class="grid-wrapper">
						<Grid
							data={reports.projectSummary}
							columns={projectColumns}
							selection="row"
							autoheight={true}
						/>
					</div>
				{/if}

				<!-- ── Tab: Architect Workload ───────────────────────────────── -->
			{:else if activeTab === 'architects'}
				{#if reports.architectWorkload.length === 0}
					<div class="empty-state">No architects match the current filters.</div>
				{:else}
					<div class="grid-wrapper">
						<Grid
							data={reports.architectWorkload}
							columns={architectColumns}
							selection="row"
							autoheight={true}
						/>
					</div>
				{/if}

				<!-- ── Tab: Overdue Tasks ────────────────────────────────────── -->
			{:else if activeTab === 'overdue'}
				{#if reports.overdueTasks.length === 0}
					<div class="empty-state empty-state--green">
						✓ No overdue tasks. Everything is on track!
					</div>
				{:else}
					<div class="grid-wrapper">
						<Grid
							data={reports.overdueTasks}
							columns={overdueColumns}
							selection="row"
							autoheight={true}
						/>
					</div>
				{/if}
			{/if}
		{:else if loading}
			<div class="flex h-64 items-center justify-center text-sm text-gray-400">
				Loading reports…
			</div>
		{/if}
	</div>
</Willow>

<style>
	.reports-root {
		max-width: 98%;
		padding: 1rem;
	}

	/* Buttons */
	.export-btn {
		padding: 0.4rem 1rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 500;
		border: 1px solid #d1d5db;
		background: white;
		color: #374151;
		cursor: pointer;
		transition: background 0.15s;
	}
	.export-btn:hover:not(:disabled) {
		background: #f3f4f6;
	}
	.export-btn--pdf {
		background: #1e3a5f;
		color: white;
		border-color: #1e3a5f;
	}
	.export-btn--pdf:hover:not(:disabled) {
		background: #1e40af;
	}
	.export-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-btn {
		padding: 0.4rem 1rem;
		border-radius: 6px;
		font-size: 0.8rem;
		background: #3b82f6;
		color: white;
		border: none;
		cursor: pointer;
		transition: background 0.15s;
	}
	.refresh-btn:hover:not(:disabled) {
		background: #2563eb;
	}
	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Filter panel */
	.filter-panel {
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		background: white;
		/* No overflow:hidden — would clip the dropdown popups */
	}
	.filter-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1rem;
		background: #f8fafc;
		border: none;
		border-radius: 10px; /* rounds all corners when body is hidden */
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		color: #374151;
	}
	.filter-toggle:hover {
		background: #f1f5f9;
	}
	.filter-toggle__label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.filter-toggle__caret {
		font-size: 0.65rem;
		color: #94a3b8;
	}
	.filter-badge {
		background: #3b82f6;
		color: white;
		font-size: 0.65rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		font-weight: 600;
	}
	.filter-body {
		padding: 1rem;
		border-top: 1px solid #e5e7eb;
		border-radius: 0 0 10px 10px;
		position: relative;
		z-index: 50; /* let dropdowns float above grids and charts below */
	}
	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}
	.filter-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 160px;
		flex: 1;
	}
	.filter-label {
		font-size: 0.73rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.filter-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.btn-apply {
		padding: 0.4rem 1.1rem;
		background: #1e3a5f;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
	}
	.btn-apply:hover:not(:disabled) {
		background: #1e40af;
	}
	.btn-apply:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-reset {
		padding: 0.4rem 0.9rem;
		background: transparent;
		color: #6b7280;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.82rem;
		cursor: pointer;
	}
	.btn-reset:hover {
		background: #f3f4f6;
	}

	/* Stat cards */
	.stat-cards {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.85rem;
	}
	.stat-card {
		border-radius: 12px;
		padding: 1rem 1.2rem;
		border: 1px solid transparent;
	}
	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		line-height: 1;
	}
	.stat-label {
		margin-top: 0.35rem;
		font-size: 0.78rem;
		font-weight: 500;
	}
	.stat-card--blue {
		background: #eff6ff;
		border-color: #bfdbfe;
	}
	.stat-card--blue .stat-value {
		color: #1d4ed8;
	}
	.stat-card--blue .stat-label {
		color: #3b82f6;
	}
	.stat-card--green {
		background: #f0fdf4;
		border-color: #bbf7d0;
	}
	.stat-card--green .stat-value {
		color: #15803d;
	}
	.stat-card--green .stat-label {
		color: #22c55e;
	}
	.stat-card--slate {
		background: #f8fafc;
		border-color: #e2e8f0;
	}
	.stat-card--slate .stat-value {
		color: #334155;
	}
	.stat-card--slate .stat-label {
		color: #64748b;
	}
	.stat-card--red {
		background: #fef2f2;
		border-color: #fecaca;
	}
	.stat-card--red .stat-value {
		color: #dc2626;
	}
	.stat-card--red .stat-label {
		color: #ef4444;
	}
	.stat-card--gray {
		background: #f9fafb;
		border-color: #e5e7eb;
	}
	.stat-card--gray .stat-value {
		color: #9ca3af;
	}
	.stat-card--gray .stat-label {
		color: #9ca3af;
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 2px;
		border-bottom: 2px solid #e5e7eb;
	}
	.tab {
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: #6b7280;
		border: none;
		background: transparent;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: color 0.15s;
	}
	.tab:hover {
		color: #374151;
	}
	.tab--active {
		color: #2563eb;
		border-bottom-color: #2563eb;
	}

	/* Overview grid */
	.overview-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	/* Chart cards */
	.chart-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 1.25rem;
	}
	.chart-card--wide {
		grid-column: span 2;
	}
	.chart-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: #1e293b;
	}
	.chart-note {
		font-size: 0.75rem;
		font-weight: 400;
		color: #94a3b8;
	}
	.chart-sub {
		font-size: 0.75rem;
		color: #94a3b8;
		margin-top: 0.2rem;
		margin-bottom: 0.75rem;
	}
	.chart-area {
		position: relative;
		height: 220px;
	}
	.chart-area--tall {
		height: 300px;
	}

	/* Overdue preview */
	.overdue-preview {
		grid-column: span 2;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		padding: 1.25rem;
	}
	.overdue-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: white;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}
	.overdue-left {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		min-width: 0;
	}
	.overdue-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}
	.overdue-badge {
		background: #fee2e2;
		color: #dc2626;
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
	}

	/* Grid wrapper */
	.grid-wrapper {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
	}

	/* Empty states */
	.empty-state {
		padding: 2.5rem;
		text-align: center;
		border-radius: 10px;
		border: 1px solid #fde68a;
		background: #fffbeb;
		color: #b45309;
		font-weight: 500;
	}
	.empty-state--green {
		border-color: #bbf7d0;
		background: #f0fdf4;
		color: #15803d;
	}

	@media (max-width: 768px) {
		.stat-cards {
			grid-template-columns: repeat(2, 1fr);
		}
		.overview-grid {
			grid-template-columns: 1fr;
		}
		.chart-card--wide {
			grid-column: span 1;
		}
		.overdue-preview {
			grid-column: span 1;
		}
		.filter-row {
			flex-direction: column;
		}
	}
</style>
