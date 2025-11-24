// src/lib/types.ts

export interface Task {
	architectId: string | null;
	architectName: string | null;
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
	// tasks: Task[];
}
