import { json } from '@sveltejs/kit';
import { selectPTS } from '$lib/server/db/queries/selectPTS';
import type { Architect, Project, Task } from '$lib/types';
import { status, priority } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const ptsData = await selectPTS();
		const architectData: Architect[] = [];
		const projectData: Project[] = [];
		const taskData: Task[] = [];

		// ── Build per‑architect ───────────────────────────────────────────────
		ptsData.forEach((item) => {
			const architectId = item.architectId;
			// 1) Always ensure there's an entry for this architect:
			if (!architectData[architectId]) {
				architectData[architectId] = {
					architectId,
					firstName: item.firstName,
					lastName: item.lastName,
					tasks: []
				};
			}
			// 2) Only if there's a real taskId do we push a task
			if (item.taskId) {
				const aTasks = architectData[architectId].tasks;
				if (!aTasks.find((t) => t.taskId === item.taskId)) {
					aTasks.push({
						taskId: item.taskId,
						taskName: item.taskName,
						taskDescription: item.taskDescription,
						taskStartDate: item.taskStartDate,
						taskDueDate: item.taskDueDate,
						taskStatus: item.taskStatus,
						taskPriority: item.taskPriority,
						projectName: item.projectName,
						subtasks: []
					});
				}
				// now attach any subtask
				const task = aTasks.find((t) => t.taskId === item.taskId)!;
				if (item.subtaskId) {
					task.subtasks.push({
						subtaskId: item.subtaskId,
						subtaskName: item.subtaskName,
						subtaskDescription: item.subtaskDescription,
						subtaskStatus: item.subtaskStatus
					});
				}
			}
		});

		// ── Build per‑task ───────────────────────────────────────────────
		ptsData.forEach((item) => {
			const taskId = item.taskId;
			// 1) Always ensure there's an entry for this project:
			if (!taskData[taskId]) {
				taskData[taskId] = {
					architectFirstName: item.firstName,
					taskId,
					taskName: item.taskName,
					taskDescription: item.taskDescription,
					taskStartDate: item.taskStartDate,
					taskDueDate: item.taskDueDate,
					taskStatus: item.taskStatus,
					taskPriority: item.taskPriority,
					projectName: item.projectName,
					subtasks: []
				};
			}
			console.log(taskData);
			// now attach any subtask
			const sTasks = taskData[taskId].subtasks;
			if (!sTasks.find((s) => s.subtaskId === item.subtaskId)) {
				sTasks.push({
					subtaskId: item.subtaskId,
					subtaskName: item.subtaskName,
					subtaskDescription: item.subtaskDescription,
					subtaskStatus: item.subtaskStatus
				});
			}
		});

		// ── Build per‑project ───────────────────────────────────────────────
		ptsData.forEach((item) => {
			const projectId = item.projectId;
			// 1) Always ensure there's an entry for this project:
			if (!projectData[projectId]) {
				projectData[projectId] = {
					projectId,
					projectName: item.projectName,
					projectDescription: item.projectDescription,
					projectStartDate: item.projectStartDate,
					projectDueDate: item.projectDueDate,
					projectStatus: item.projectStatus,
					projectPriority: item.projectPriority,
					tasks: []
				};
			}
			// 2) Only if there's a real taskId do we push a task
			if (item.taskId) {
				const pTasks = projectData[projectId].tasks;
				if (!pTasks.find((t) => t.taskId === item.taskId)) {
					pTasks.push({
						architectFirstName: item.firstName,
						taskId: item.taskId,
						taskName: item.taskName,
						taskDescription: item.taskDescription,
						taskStartDate: item.taskStartDate,
						taskDueDate: item.taskDueDate,
						taskStatus: item.taskStatus,
						taskPriority: item.taskPriority,
						projectName: item.projectName,
						subtasks: []
					});
				}
				// now attach any subtask
				const task = pTasks.find((t) => t.taskId === item.taskId)!;
				if (item.subtaskId) {
					task.subtasks.push({
						subtaskId: item.subtaskId,
						subtaskName: item.subtaskName,
						subtaskDescription: item.subtaskDescription,
						subtaskStatus: item.subtaskStatus
					});
				}
			}
		});

		// ── Sort & return ────────────────────────────────────────
		const priorityOrder = { High: 1, Medium: 2, Low: 3 };

		Object.values(architectData).forEach((arch) =>
			arch.tasks.sort((a, b) => {
				const p = priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority];
				return p || new Date(a.taskDueDate).getTime() - new Date(b.taskDueDate).getTime();
			})
		);

		Object.values(projectData).forEach((proj) =>
			proj.tasks.sort((a, b) => {
				const p = priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority];
				return p || new Date(a.taskDueDate).getTime() - new Date(b.taskDueDate).getTime();
			})
		);

		Object.values(
			taskData.sort((a, b) => {
				const p = priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority];
				return p || new Date(a.taskDueDate).getTime() - new Date(b.taskDueDate).getTime();
			})
		);

		// Return JSON response
		return json({
			architectDataValues: Object.values(architectData),
			taskDataValues: Object.values(taskData),
			projectDataValues: Object.values(projectData),
			status: Object.values(status.enumValues),
			priority: Object.values(priority.enumValues)
		});
	} catch (error) {
		console.error('Error fetching PTS data:', error);
		return json({ error: 'Failed to fetch PTS data' }, { status: 500 });
	}
};

// Optional: Add other HTTP methods if needed
export const POST: RequestHandler = async ({ request }) => {
	// Handle POST requests if needed
	return json({ message: 'POST not implemented' }, { status: 405 });
};
