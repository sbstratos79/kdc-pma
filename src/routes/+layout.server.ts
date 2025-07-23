import { selectPTS } from '$lib/server/db/queries/selectPTS';
import type { Architect, Project } from '$lib/types';
import { status, priority } from '$lib/server/db/schema';

export const load = async () => {
	const ptsData = await selectPTS();
	const architectData: Architect[] = [];
	const projectData: Project[] = [];

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

	// ── Sort & return (unchanged) ────────────────────────────────────────
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

	console.log(architectData);
	return {
		architectDataValues: Object.values(architectData),
		projectDataValues: Object.values(projectData),
		status: status.enumValues,
		priority: priority.enumValues
	};
};
