import { json } from '@sveltejs/kit';
import { selectPTS } from '$lib/server/db/queries/selectPTS';
import type { Architect, ArchitectProject, Project, Task } from '$lib/types';
import { status, priority } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';
import {
	insertArchitect,
	insertProject,
	insertTask,
	insertSubtask
} from '$lib/server/db/queries/insert';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const ptsData = await selectPTS();
		const architectData: Architect[] = [];
		const architectProjectData: ArchitectProject[] = [];
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

		// ── Build per‑architect per-project ───────────────────────────────────────────────
		ptsData.forEach((item) => {
			const architectId = item.architectId;
			const projectId = item.projectId;
			// 1) Always ensure there's an entry for this architect:
			if (!architectProjectData[architectId]) {
				architectProjectData[architectId] = {
					architectId,
					firstName: item.firstName,
					lastName: item.lastName,
					projects: []
				};
			}
			// 2) Only if there's a real projectId do we push a project
			if (item.projectId) {
				const aProjects = architectProjectData[architectId].projects;
				if (!aProjects.find((t) => t.projectId === item.projectId)) {
					aProjects.push({
						projectId: item.projectId,
						projectName: item.projectName,
						projectDescription: item.projectDescription,
						projectStartDate: item.projectStartDate,
						projectDueDate: item.projectDueDate,
						projectStatus: item.projectStatus,
						projectPriority: item.projectPriority,
						tasks: []
					});
				}
			}
			// 2) Only if there's a real taskId do we push a task
			if (item.taskId) {
				// Find the project first
				const project = architectProjectData[architectId].projects.find(
					(p) => p.projectId === projectId
				);
				if (project) {
					const pTasks = project.tasks;
					if (!pTasks.find((t) => t.taskId === item.taskId)) {
						pTasks.push({
							taskId: item.taskId,
							taskName: item.taskName,
							// ... other task properties
							subtasks: []
						});
					}

					// Add subtask if it exists and isn't already added
					if (item.subtaskId) {
						const task = pTasks.find((t) => t.taskId === item.taskId)!;
						if (!task.subtasks.find((s) => s.subtaskId === item.subtaskId)) {
							task.subtasks.push({
								subtaskId: item.subtaskId,
								subtaskName: item.subtaskName,
								subtaskDescription: item.subtaskDescription,
								subtaskStatus: item.subtaskStatus
							});
						}
					}
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
			// now attach any subtask if it exists
			if (item.subtaskId) {
				const sTasks = taskData[taskId].subtasks;
				if (!sTasks.find((s) => s.subtaskId === item.subtaskId)) {
					sTasks.push({
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

		// ── Sort & return ────────────────────────────────────────
		const priorityOrder = { High: 1, Medium: 2, Low: 3 };

		Object.values(architectData).forEach((arch) =>
			arch.tasks.sort((a, b) => {
				const p = priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority];
				return p || new Date(a.taskDueDate).getTime() - new Date(b.taskDueDate).getTime();
			})
		);

		Object.values(architectProjectData).forEach((architect) => {
			architect.projects.forEach((project) => {
				project.tasks.sort((a, b) => {
					const p = priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority];
					return p || new Date(a.taskDueDate).getTime() - new Date(b.taskDueDate).getTime();
				});
			});
		});

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
			architectProjectDataValues: Object.values(architectProjectData),
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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { type, data } = body;

		if (!type || !data) {
			return json(
				{
					error: 'Missing required fields: type and data'
				},
				{ status: 400 }
			);
		}

		let result;

		switch (type) {
			case 'architect':
				result = await createArchitect(data);
				break;
			case 'project':
				result = await createProject(data);
				break;
			case 'task':
				result = await createTask(data);
				break;
			case 'subtask':
				result = await createSubtask(data);
				break;
			default:
				return json(
					{
						error: 'Invalid type. Must be one of: architect, project, task, subtask'
					},
					{ status: 400 }
				);
		}

		return json(
			{
				success: true,
				data: result,
				message: `${type} created successfully`
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating entry:', error);
		return json(
			{
				error: 'Failed to create entry',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// Helper functions for each entity type
async function createArchitect(data: any) {
	const { firstName, lastName } = data;

	if (!firstName || !lastName) {
		throw new Error('Architect requires firstName and lastName');
	}

	const architectData = {
		firstName: firstName.trim(),
		lastName: lastName.trim()
	};

	return await insertArchitect(architectData);
}

async function createProject(data: any) {
	const {
		projectName,
		projectDescription,
		projectStartDate,
		projectDueDate,
		projectStatus = 'Planning',
		projectPriority = 'Medium'
	} = data;

	if (!projectName) {
		throw new Error('Project requires projectName');
	}

	// Validate dates
	if (projectStartDate && !isValidDate(projectStartDate)) {
		throw new Error('Invalid projectStartDate format');
	}
	if (projectDueDate && !isValidDate(projectDueDate)) {
		throw new Error('Invalid projectDueDate format');
	}

	// Validate status and priority
	const validStatuses = ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
	const validPriorities = ['High', 'Medium', 'Low'];

	if (!validStatuses.includes(projectStatus)) {
		throw new Error(`Invalid projectStatus. Must be one of: ${validStatuses.join(', ')}`);
	}
	if (!validPriorities.includes(projectPriority)) {
		throw new Error(`Invalid projectPriority. Must be one of: ${validPriorities.join(', ')}`);
	}

	const projectData = {
		name: projectName.trim(),
		description: projectDescription?.trim() || null,
		startDate: projectStartDate || null,
		dueDate: projectDueDate || null,
		status: projectStatus,
		priority: projectPriority
	};

	return await insertProject(projectData);
}

async function createTask(data: any) {
	const {
		taskName,
		taskDescription,
		taskStartDate,
		taskDueDate,
		taskStatus = 'Planning',
		taskPriority = 'Medium',
		projectId,
		architectId
	} = data;

	if (!taskName || !projectId || !architectId) {
		throw new Error('Task requires taskName, projectId, and architectId');
	}

	// Validate dates
	if (taskStartDate && !isValidDate(taskStartDate)) {
		throw new Error('Invalid taskStartDate format');
	}
	if (taskDueDate && !isValidDate(taskDueDate)) {
		throw new Error('Invalid taskDueDate format');
	}

	// Validate status and priority
	const validStatuses = ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
	const validPriorities = ['High', 'Medium', 'Low'];

	if (!validStatuses.includes(taskStatus)) {
		throw new Error(`Invalid taskStatus. Must be one of: ${validStatuses.join(', ')}`);
	}
	if (!validPriorities.includes(taskPriority)) {
		throw new Error(`Invalid taskPriority. Must be one of: ${validPriorities.join(', ')}`);
	}

	const taskData = {
		name: taskName.trim(),
		description: taskDescription?.trim() || null,
		startDate: taskStartDate || null,
		dueDate: taskDueDate || null,
		status: taskStatus,
		priority: taskPriority,
		projectId: String(projectId),
		architectId: String(architectId)
	};

	return await insertTask(taskData);
}

async function createSubtask(data: any) {
	const { subtaskName, subtaskDescription, subtaskStatus = 'Planning', taskId } = data;

	if (!subtaskName || !taskId) {
		throw new Error('Subtask requires subtaskName and taskId');
	}

	// Validate status
	const validStatuses = ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
	if (!validStatuses.includes(subtaskStatus)) {
		throw new Error(`Invalid subtaskStatus. Must be one of: ${validStatuses.join(', ')}`);
	}

	const subtaskData = {
		name: subtaskName.trim(),
		description: subtaskDescription?.trim() || null,
		status: subtaskStatus,
		taskId: String(taskId)
	};

	return await insertSubtask(subtaskData);
}

// Utility function to validate date strings
function isValidDate(dateString: string): boolean {
	const date = new Date(dateString);
	return date instanceof Date && !isNaN(date.getTime());
}
