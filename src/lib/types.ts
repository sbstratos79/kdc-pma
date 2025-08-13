// src/lib/types.ts

export interface Subtask {
	subtaskId: string;
	subtaskName: string;
	subtaskDescription: string | null;
	subtaskStatus: string;
}

export interface Task {
	architectFirstName: string | null;
	taskId: string;
	taskName: string;
	taskDescription: string | null;
	taskStartDate: string | null;
	taskDueDate: string | null;
	taskStatus: string;
	taskPriority: string;
	projectName: string | null;
	subtasks: Subtask[];
}

export interface Project {
	projectId: string;
	projectName: string;
	projectDescription: string;
	projectStartDate: string | null;
	projectDueDate: string | null;
	projectStatus: string | null;
	projectPriority: string | null;
	tasks: Task[];
}

export interface Architect {
	architectId: string;
	firstName: string;
	lastName: string | null;
	tasks: Task[];
}

export interface ArchitectProject {
	architectId: string;
	firstName: string;
	lastName: string | null;
	projects: Project[];
}

// Response type for the API endpoint
export interface PTSApiResponse {
	architectDataValues: Architect[];
	architectProjectDataValues: ArchitectProject[];
	taskDataValues: Task[];
	projectDataValues: Project[];
	status: string[];
	priority: string[];
}

// If you need to handle API errors
export interface PTSApiError {
	error: string;
}
