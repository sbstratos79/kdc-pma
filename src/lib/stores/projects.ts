import { createEntityStore } from './_entityStore';
import type { Project } from '$lib/types';

type CreatePayload = {
	projectId: string;
	projectName: string;
	projectDescription?: string | null;
	projectStartDate?: string | null;
	projectDueDate?: string | null;
	projectStatus?: string;
	projectPriority?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(api: any): Project {
	return {
		projectId: api.projectId || api.id || '',
		projectName: api.projectName || api.name || '',
		projectDescription: (api.projectDescription || api.description) ?? null,
		projectStartDate: (api.projectStartDate || api.startDate) ?? null,
		addedTime: api.addedTime || null,
		projectDueDate: (api.projectDueDate || api.dueDate) ?? null,
		projectStatus: api.projectStatus || api.status || '',
		projectPriority: api.projectPriority || api.priority || '',
		tasks: api.tasks || []
	};
}

export const projectsStore = createEntityStore<Project, CreatePayload>({
	endpoint: '/api/projects',
	getId: (p) => p.projectId,
	getLabel: (p) => p.projectName,
	mapItem,
	buildTemp: (p) => ({
		projectId: p.projectId,
		projectName: p.projectName,
		projectDescription: p.projectDescription ?? null,
		projectStartDate: p.projectStartDate ?? null,
		projectDueDate: p.projectDueDate ?? null,
		addedTime: null,
		projectStatus: p.projectStatus ?? 'Planning',
		projectPriority: p.projectPriority ?? 'Medium',
		tasks: []
	})
});
