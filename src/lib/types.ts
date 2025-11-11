// src/lib/types.ts

export interface Task {
	architectId: string | null;
	architectName: string | null;
	taskId: string;
	taskName: string;
	taskDescription: string | null;
	taskStartDate: string | null;
	taskDueDate: string | null;
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
	projectStatus: string;
	projectPriority: string;
	tasks: Task[];
}

export interface Architect {
	architectId: string;
	architectName: string;
	// tasks: Task[];
}

export interface ArchitectProject {
	architectId: string;
	architectName: string;
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
