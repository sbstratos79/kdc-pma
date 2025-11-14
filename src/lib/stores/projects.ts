// src/lib/stores/projects.ts
import { writable, get, type Writable } from 'svelte/store';
import { createFetcher } from './_fetcher';
import type { Project } from '$lib/types';

type State = {
	loading: boolean;
	error?: string | null;
	list: Project[];
	byId: Record<string, Project>;
};

const fetcher = createFetcher<Project[]>('/api/projects', 5000); // 5seconds TTL

function makeInitial(): State {
	return { loading: false, error: null, list: [], byId: {} };
}

function createProjectsStore() {
	const store: Writable<State> = writable(makeInitial());

	// Map API response to Project DTO
	function mapApiResponseToProject(apiProject: any): Project {
		return {
			projectId: apiProject.projectId || apiProject.id || '',
			projectName: apiProject.projectName || apiProject.name || '',
			projectDescription: apiProject.projectDescription || apiProject.description || null,
			projectStartDate: apiProject.projectStartDate || apiProject.startDate || null,
			addedTime: apiProject.addedTime || null,
			projectDueDate: apiProject.projectDueDate || apiProject.dueDate || null,
			projectStatus: apiProject.projectStatus || apiProject.status || '',
			projectPriority: apiProject.projectPriority || apiProject.priority || '',
			tasks: apiProject.tasks || []
		};
	}

	async function load(force = false) {
		store.update((s) => ({ ...s, loading: true, error: null }));
		try {
			const result = await fetcher.fetch(force);
			const rawData = Array.isArray(result) ? result : (result as any)?.data || [];
			const data = rawData.map(mapApiResponseToProject);
			const byId: Record<string, Project> = {};
			data.forEach((p) => (byId[p.projectId] = p));
			store.set({ loading: false, error: null, list: data, byId });
			return data;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			store.update((s) => ({ ...s, loading: false, error: msg }));
			throw err;
		}
	}

	function options() {
		const s = get(store);
		return (s.list || []).map((p) => ({ id: p.projectId, label: p.projectName }));
	}

	function getById(id: string) {
		return get(store).byId[id] ?? null;
	}

	// local optimistic helpers
	function addLocal(item: Project) {
		store.update((s) => {
			const list = [...s.list, item];
			const byId = { ...s.byId, [item.projectId]: item };
			return { ...s, list, byId };
		});
	}

	function updateLocal(id: string, patch: Partial<Project>) {
		store.update((s) => {
			const existing = s.byId[id];
			if (!existing) return s;
			const updated = { ...existing, ...patch };
			const list = s.list.map((x) => (x.projectId === id ? updated : x));
			const byId = { ...s.byId, [id]: updated };
			return { ...s, list, byId };
		});
	}

	function removeLocal(id: string) {
		store.update((s) => {
			const list = s.list.filter((x) => x.projectId !== id);
			const byId = { ...s.byId };
			delete byId[id];
			return { ...s, list, byId };
		});
	}

	// CRUD API calls
	async function create(payload: {
		projectId: string;
		projectName: string;
		projectDescription?: string | null;
		projectStartDate?: string | null;
		projectDueDate?: string | null;
		projectStatus?: string;
		projectPriority?: string;
	}) {
		const temp: Project = {
			projectId: payload.projectId,
			projectName: payload.projectName,
			projectDescription: payload.projectDescription ?? null,
			projectStartDate: payload.projectStartDate ?? null,
			projectDueDate: payload.projectDueDate ?? null,
			addedTime: null,
			projectStatus: payload.projectStatus ?? 'Planning',
			projectPriority: payload.projectPriority ?? 'Medium',
			tasks: []
		};

		addLocal(temp);

		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Create project failed');
			}
			const json = await res.json();
			const created = json?.data as any;
			const mappedProject = mapApiResponseToProject(created);

			// Replace temp with real project
			removeLocal(payload.projectId);
			if (mappedProject) addLocal(mappedProject);

			return mappedProject;
		} catch (err) {
			removeLocal(payload.projectId);
			throw err;
		}
	}

	async function update(id: string, changes: Partial<Project>) {
		const before = getById(id);
		updateLocal(id, changes);

		try {
			const res = await fetch('/api/projects', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, data: changes })
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Update failed');
			}
			const json = await res.json();
			const updated = json?.data as any;
			const mappedProject = mapApiResponseToProject(updated);
			if (mappedProject) updateLocal(id, mappedProject);
			return mappedProject;
		} catch (err) {
			if (before) updateLocal(id, before);
			throw err;
		}
	}

	async function remove(id: string) {
		const before = getById(id);
		removeLocal(id);

		try {
			const res = await fetch('/api/projects', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Delete failed');
			}
			const json = await res.json();
			return json?.data ?? null;
		} catch (err) {
			if (before) addLocal(before);
			throw err;
		}
	}

	function clear() {
		fetcher.clear();
		store.set(makeInitial());
	}

	return {
		subscribe: store.subscribe,
		load,
		refresh: () => load(true),
		options,
		getById,
		addLocal,
		updateLocal,
		removeLocal,
		create,
		update,
		remove,
		clear
	};
}

export const projectsStore = createProjectsStore();
