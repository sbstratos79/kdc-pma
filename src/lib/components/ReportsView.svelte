<!-- src/lib/components/ReportsView.svelte -->
<!--
  Dependencies: npm install chart.js pdfkit @types/pdfkit
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { Willow, RichSelect, DateRangePicker, Text } from 'wx-svelte-core';
	import { Grid } from 'wx-svelte-grid';
	import { formatDate } from '$lib/utils/dateUtils';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { getStatusColor } from '$lib/utils/colorUtils';
	import { enumsStore, architectsStore } from '$lib/stores';
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

	// Filter state
	let searchTerm = $state('');
	let dueRange = $state<{ start: Date | null; end: Date | null }>({ start: null, end: null });
	let architectId = $state<string>('all');
	let statusFilter = $state<string>('all');
	let priorityFilter = $state<string>('all');

	// Store subscriptions for filter options
	let enumsState = $state<{
		loading: boolean;
		value?: { status: string[]; priority: string[] };
		error?: string | null;
	}>({ loading: false });
	$effect(() => {
		const unsub = enumsStore.subscribe((s) => {
			enumsState = s;
		});
		return unsub;
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let architectsState = $state<any>({ list: [], loading: true, error: null });
	$effect(() => {
		const unsub = architectsStore.subscribe((s) => {
			architectsState = s;
		});
		return unsub;
	});

	// Derived filter options from stores
	let architectOptions = $derived([
		{ id: 'all', label: 'All Architects' },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		...architectsState.list.map((a: any) => ({ id: a.architectId, label: a.architectName }))
	]);
	let statusOptions = $derived([
		{ id: 'all', label: 'All Status' },
		...(enumsState.value?.status?.map((s: string) => ({ id: s, label: s })) ?? [])
	]);
	let priorityOptions = $derived([
		{ id: 'all', label: 'All Priorities' },
		...(enumsState.value?.priority?.map((p: string) => ({ id: p, label: p })) ?? [])
	]);

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
		searchTerm !== '' ||
			dueRange.start !== null ||
			dueRange.end !== null ||
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
		const p = new SvelteURLSearchParams();
		if (searchTerm) p.set('search', searchTerm);
		if (dueRange.start) p.set('dateFrom', dueRange.start.toISOString().split('T')[0]);
		if (dueRange.end) p.set('dateTo', dueRange.end.toISOString().split('T')[0]);
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

	function resetFilters() {
		searchTerm = '';
		dueRange = { start: null, end: null };
		architectId = 'all';
		statusFilter = 'all';
		priorityFilter = 'all';
		loadReports();
	}

	onMount(async () => {
		await Promise.all([enumsStore.load(), architectsStore.load()]);
		await loadReports();
	});

	// Debounced filter change handler
	let filterTimeout: ReturnType<typeof setTimeout>;
	function handleFilterChange() {
		clearTimeout(filterTimeout);
		filterTimeout = setTimeout(loadReports, 300);
	}

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
	<div>
		<!-- ── Header ─────────────────────────────────────────────────── -->
		<div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-2xl font-bold text-gray-800">Reports</h2>
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={() => exportReport('csv')}
					disabled={loading || exporting !== null}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
							points="7 10 12 15 17 10"
						/><line x1="12" y1="15" x2="12" y2="3" /></svg
					>
					{exporting === 'csv' ? 'Exporting…' : 'CSV'}
				</button>
				<button
					class="flex items-center gap-1.5 rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={() => exportReport('pdf')}
					disabled={loading || exporting !== null}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path
							d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
						/><polyline points="14 2 14 8 20 8" /></svg
					>
					{exporting === 'pdf' ? 'Exporting…' : 'PDF'}
				</button>
				<button
					class="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={loadReports}
					disabled={loading}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path
							d="M3 3v5h5"
						/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path
							d="M16 21h5v-5"
						/></svg
					>
					{loading ? 'Loading…' : 'Refresh'}
				</button>
			</div>
		</div>

		<!-- ── Filters ─────────────────────────────────────────────────── -->
		<div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
			<Text
				css="height:100%;"
				clear
				bind:value={searchTerm}
				placeholder="Search..."
				onchange={handleFilterChange}
			/>
			<RichSelect
				options={architectOptions}
				bind:value={architectId}
				clear
				onchange={handleFilterChange}
			/>
			<RichSelect
				options={statusOptions}
				bind:value={statusFilter}
				clear
				onchange={handleFilterChange}
			/>
			<RichSelect
				options={priorityOptions}
				bind:value={priorityFilter}
				clear
				onchange={handleFilterChange}
			/>
			<DateRangePicker
				title="Date Range"
				placeholder="Pick a range"
				bind:value={dueRange}
				clear
				onchange={handleFilterChange}
			/>
			{#if hasActiveFilters}
				<button
					class="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
					onclick={resetFilters}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg
					>
					Reset
				</button>
			{/if}
		</div>

		{#if error}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
				<div class="flex items-start gap-3">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="mt-0.5 flex-shrink-0"
						><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
							x1="12"
							y1="16"
							x2="12.01"
							y2="16"
						/></svg
					>
					<div>
						<h4 class="font-semibold">Error loading data</h4>
						<p class="mt-1 text-sm">{error}</p>
					</div>
				</div>
			</div>
		{/if}

		{#if !loading && reports}
			<div class="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
				<div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
					<div class="text-3xl leading-none font-bold text-blue-700">{totalProjects}</div>
					<div class="mt-1.5 text-xs font-medium text-blue-500">Total Projects</div>
				</div>
				<div class="rounded-xl border border-green-200 bg-green-50 p-4">
					<div class="text-3xl leading-none font-bold text-green-700">{completedProjects}</div>
					<div class="mt-1.5 text-xs font-medium text-green-500">Completed</div>
				</div>
				<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
					<div class="text-3xl leading-none font-bold text-slate-700">{totalTasks}</div>
					<div class="mt-1.5 text-xs font-medium text-slate-400">Total Tasks</div>
				</div>
				<div
					class="rounded-xl border p-4 {overdueCount > 0
						? 'border-red-200 bg-red-50'
						: 'border-gray-200 bg-gray-50'}"
				>
					<div
						class="text-3xl leading-none font-bold {overdueCount > 0
							? 'text-red-600'
							: 'text-gray-400'}"
					>
						{overdueCount}
					</div>
					<div
						class="mt-1.5 text-xs font-medium {overdueCount > 0 ? 'text-red-500' : 'text-gray-400'}"
					>
						Overdue Tasks
					</div>
				</div>
			</div>

			<!-- ── Tabs ──────────────────────────────────────────────────── -->
			<div class="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
				{#each tabs as tab (tab[0])}
					<button
						class="cursor-pointer border-none bg-transparent px-4 py-3 text-sm font-medium transition-colors {activeTab ===
						tab[0]
							? 'border-b-2 border-blue-600 text-blue-700'
							: 'border-b-2 border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-800'}"
						onclick={() => (activeTab = tab[0] as typeof activeTab)}
					>
						{tab[1]}
						{#if tab[0] === 'overdue' && overdueCount > 0}<span
								class="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
								>{overdueCount}</span
							>{/if}
					</button>
				{/each}
			</div>

			<!-- ── Tab: Overview ─────────────────────────────────────────── -->
			{#if activeTab === 'overview'}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<!-- Status chart -->
					<div
						class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:col-span-2"
					>
						<div class="border-b border-gray-100 p-4">
							<h3 class="text-sm font-semibold text-gray-800">Status Distribution</h3>
							<p class="mt-1 text-xs text-gray-500">
								Projects vs. tasks per status — lighter bars are projects, solid are tasks
							</p>
						</div>
						<div class="h-64 p-4">
							<canvas bind:this={statusCanvas}></canvas>
						</div>
					</div>

					<!-- Priority doughnut -->
					<div
						class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:col-span-1"
					>
						<div class="border-b border-gray-100 p-4">
							<h3 class="text-sm font-semibold text-gray-800">Task Priority Mix</h3>
							<p class="mt-1 text-xs text-gray-500">Distribution of tasks by priority level</p>
						</div>
						<div class="flex h-64 items-center justify-center p-4">
							<canvas bind:this={priorityCanvas}></canvas>
						</div>
					</div>

					<!-- Architect workload -->
					<div
						class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:col-span-2"
					>
						<div class="border-b border-gray-100 p-4">
							<h3 class="text-sm font-semibold text-gray-800">
								Architect Workload <span class="ml-2 text-xs font-normal text-gray-400"
									>(top 10)</span
								>
							</h3>
							<p class="mt-1 text-xs text-gray-500">Active tasks vs. overdue tasks per architect</p>
						</div>
						<div class="h-80 p-4">
							<canvas bind:this={workloadCanvas}></canvas>
						</div>
					</div>

					<!-- Overdue preview -->
					{#if reports.overdueTasks.length > 0}
						<div class="rounded-lg border border-red-100 bg-red-50 p-4 md:col-span-2">
							<h3 class="flex items-center gap-2 text-sm font-semibold text-red-800">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
										x1="12"
										y1="16"
										x2="12.01"
										y2="16"
									/></svg
								>
								Most Overdue Tasks
							</h3>
							<div class="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
								{#each reports.overdueTasks.slice(0, 5) as task (task.taskId)}
									<div class="flex items-center justify-between rounded-md bg-white p-3 shadow-sm">
										<div class="min-w-0">
											<span class="font-medium text-gray-800">{task.taskName}</span>
											<span
												class="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold {getStatusColor(
													task.status
												)}">{task.status}</span
											>
											<span class="ml-2 text-xs text-gray-400">{task.projectName}</span>
										</div>
										<div class="flex shrink-0 items-center gap-2">
											<span class="text-xs text-gray-500">{task.architectName}</span>
											<span
												class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
												>{task.daysOverdue}d late</span
											>
										</div>
									</div>
								{/each}
							</div>
							{#if reports.overdueTasks.length > 5}
								<button
									class="mt-3 text-xs font-medium text-red-700 underline hover:text-red-800"
									onclick={() => (activeTab = 'overdue')}
								>
									View all {reports.overdueTasks.length} overdue tasks
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- ── Tab: Project Summary ───────────────────────────────────── -->
			{:else if activeTab === 'projects'}
				{#if reports.projectSummary.length === 0}
					<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
						<p class="font-medium text-yellow-700">No projects match the current filters.</p>
					</div>
				{:else}
					<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
						<Grid data={reports.projectSummary} columns={projectColumns} />
					</div>
				{/if}
			{:else if activeTab === 'architects'}
				{#if reports.architectWorkload.length === 0}
					<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
						<p class="font-medium text-yellow-700">No architects match the current filters.</p>
					</div>
				{:else}
					<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
						<Grid data={reports.architectWorkload} columns={architectColumns} />
					</div>
				{/if}
			{:else if activeTab === 'overdue'}
				{#if reports.overdueTasks.length === 0}
					<div class="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
						<p class="flex items-center justify-center gap-2 text-lg font-semibold text-green-800">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline
									points="22 4 12 14.01 9 11.01"
								/></svg
							>
							No overdue tasks. Everything is on track!
						</p>
					</div>
				{:else}
					<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
						<Grid data={reports.overdueTasks} columns={overdueColumns} />
					</div>
				{/if}
			{/if}
		{:else if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
			</div>
		{:else}
			<div class="text-sm text-gray-400">Loading reports…</div>
		{/if}
	</div>
</Willow>
