import { writable, get, type Writable } from 'svelte/store';
import { createFetcher } from './_fetcher';
import type { Task } from '$lib/types';

type State = {
	loading: boolean;
	error?: string | null;
	list: Task[];
	byId: Record<string, Task>;
};

const fetcher = createFetcher<Task[]>('/api/tasks', 5000);

function makeInitial(): State {
	return { loading: false, error: null, list: [], byId: {} };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(api: any): Task {
	return {
		taskId: api.taskId || api.id || '',
		taskName: api.taskName || api.name || '',
		taskDescription: (api.taskDescription || api.description) ?? null,
		taskStartDate: (api.taskStartDate || api.startDate) ?? null,
		taskDueDate: (api.taskDueDate || api.dueDate) ?? null,
		addedTime: api.addedTime || null,
		taskStatus: api.taskStatus || api.status || '',
		taskPriority: api.taskPriority || api.priority || '',
		projectId: api.projectId || '',
		projectName: api.projectName || '',
		architectId: api.architectId || '',
		architectName: api.architectName || ''
	};
}

export function createTasksStore() {
	const store: Writable<State> = writable(makeInitial());
	let isInitialLoad = true;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let cachedArchitectsById: Record<string, any> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let cachedProjectsById: Record<string, any> = {};

	function enrichTask(task: Task): Task {
		if (task.architectId && cachedArchitectsById[task.architectId]) {
			task.architectName = cachedArchitectsById[task.architectId].architectName || '';
		}
		if (task.projectId && cachedProjectsById[task.projectId]) {
			task.projectName = cachedProjectsById[task.projectId].projectName || '';
		}
		return task;
	}

	async function notifyServerAboutTasks(tasks: Task[], initialize = false) {
		try {
			await fetch('/api/tts/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tasks, initialize })
			});
		} catch (err) {
			console.error('Failed to notify server about tasks:', err);
		}
	}

	async function load(force = false) {
		store.update((s) => ({ ...s, loading: true }));
		try {
			const result = await fetcher.fetch(force);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rawData = Array.isArray(result) ? result : (result as any)?.data || [];

			const data = rawData.map((item: unknown) => enrichTask(mapItem(item)));

			const byId: Record<string, Task> = {};
			data.forEach((t: Task) => (byId[t.taskId] = t));
			store.set({ loading: false, error: null, list: data, byId });

			await notifyServerAboutTasks(data, isInitialLoad);

			if (isInitialLoad) {
				isInitialLoad = false;
			}

			return data;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			store.update((s) => ({ ...s, loading: false, error: msg }));
			throw err;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function loadWithNames(architectsById: Record<string, any>, projectsById: Record<string, any>) {
		cachedArchitectsById = architectsById;
		cachedProjectsById = projectsById;

		store.update((s) => {
			s.list.forEach((task) => {
				if (task.architectId && architectsById[task.architectId]) {
					task.architectName = architectsById[task.architectId].architectName || '';
				}
				if (task.projectId && projectsById[task.projectId]) {
					task.projectName = projectsById[task.projectId].projectName || '';
				}
			});

			const byId: Record<string, Task> = {};
			s.list.forEach((t: Task) => (byId[t.taskId] = t));

			notifyServerAboutTasks(s.list);

			return { ...s, byId };
		});
	}

	function options() {
		const s = get(store);
		return (s.list || []).map((t) => ({ id: t.taskId, label: t.taskName }));
	}

	function getById(id: string) {
		return get(store).byId[id] ?? null;
	}

	function addLocal(item: Task) {
		store.update((s) => {
			const enriched = enrichTask(item);
			return {
				...s,
				list: [...s.list, enriched],
				byId: { ...s.byId, [enriched.taskId]: enriched }
			};
		});
	}

	function updateLocal(id: string, patch: Partial<Task>) {
		store.update((s) => {
			const existing = s.byId[id];
			if (!existing) return s;
			const updated = enrichTask({ ...existing, ...patch });
			return {
				...s,
				list: s.list.map((x) => (x.taskId === id ? updated : x)),
				byId: { ...s.byId, [id]: updated }
			};
		});
	}

	function removeLocal(id: string) {
		store.update((s) => {
			const byId = { ...s.byId };
			delete byId[id];
			return { ...s, list: s.list.filter((x) => x.taskId !== id), byId };
		});
	}

	async function create(payload: {
		taskId: string;
		taskName: string;
		projectId: string;
		architectId: string;
		taskDescription?: string | null;
		taskStartDate?: string | null;
		taskDueDate?: string | null;
		taskStatus?: string;
		taskPriority?: string;
	}) {
		const temp: Task = {
			taskId: payload.taskId,
			taskName: payload.taskName,
			taskDescription: payload.taskDescription ?? null,
			taskStartDate: payload.taskStartDate ?? null,
			taskDueDate: payload.taskDueDate ?? null,
			addedTime: null,
			taskStatus: payload.taskStatus ?? 'Planning',
			taskPriority: payload.taskPriority ?? 'Medium',
			projectId: payload.projectId,
			projectName: '',
			architectId: payload.architectId,
			architectName: ''
		};

		addLocal(temp);

		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Create task failed');
			}
			const json = await res.json();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const created = json?.data as any;
			const mapped = mapItem(created);

			removeLocal(payload.taskId);
			if (mapped) addLocal(mapped);

			return mapped;
		} catch (err) {
			removeLocal(payload.taskId);
			throw err;
		}
	}

	async function update(id: string, changes: Partial<Task>) {
		const before = getById(id);
		updateLocal(id, changes);

		try {
			const res = await fetch('/api/tasks', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, data: changes })
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Update failed');
			}
			const json = await res.json();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const updated = json?.data as any;
			const mapped = mapItem(updated);
			if (mapped) updateLocal(id, mapped);

			return mapped;
		} catch (err) {
			if (before) updateLocal(id, before);
			throw err;
		}
	}

	async function remove(id: string) {
		const before = getById(id);
		removeLocal(id);

		try {
			const res = await fetch('/api/tasks', {
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
		cachedArchitectsById = {};
		cachedProjectsById = {};
	}

	return {
		subscribe: store.subscribe,
		load,
		refresh: () => load(true),
		loadWithNames,
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

export const tasksStore = createTasksStore();
