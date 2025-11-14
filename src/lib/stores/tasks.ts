// src/lib/stores/tasks.ts
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

function createTasksStore() {
	const store: Writable<State> = writable(makeInitial());
	let isInitialLoad = true;

	// Map API response to Task DTO
	function mapApiResponseToTask(apiTask: any): Task {
		return {
			taskId: apiTask.taskId || apiTask.id || '',
			taskName: apiTask.taskName || apiTask.name || '',
			taskDescription: apiTask.taskDescription || apiTask.description || null,
			taskStartDate: apiTask.taskStartDate || apiTask.startDate || null,
			taskDueDate: apiTask.taskDueDate || apiTask.dueDate || null,
			taskStatus: apiTask.taskStatus || apiTask.status || '',
			taskPriority: apiTask.taskPriority || apiTask.priority || '',
			projectId: apiTask.projectId || '',
			projectName: apiTask.projectName || '',
			architectId: apiTask.architectId || '',
			architectName: apiTask.architectName || ''
		};
	}

	async function load(force = false) {
		store.update((s) => ({ ...s, loading: true }));
		try {
			const result = await fetcher.fetch(force);
			const rawData = Array.isArray(result) ? result : (result as any)?.data || [];
			const data = rawData.map(mapApiResponseToTask);
			const byId: Record<string, Task> = {};
			data.forEach((t) => (byId[t.taskId] = t));
			store.set({ loading: false, error: null, list: data, byId });

			// Notify server about current tasks (server handles TTS logic)
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

	// Notify server about tasks for TTS handling
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

	// Enrich tasks with architect and project names
	function loadWithNames(architectsById: Record<string, any>, projectsById: Record<string, any>) {
		store.update((s) => {
			const enriched = s.list.map((task) => ({
				...task,
				architectName:
					(task.architectId ? architectsById[task.architectId] : '')?.architectName ||
					task.architectName ||
					'',
				projectName: projectsById[task.projectId]?.projectName || task.projectName || ''
			}));
			const byId: Record<string, Task> = {};
			enriched.forEach((t) => (byId[t.taskId] = t));

			// Notify server after enrichment
			notifyServerAboutTasks(enriched);

			return { ...s, list: enriched, byId };
		});
	}

	function options() {
		const s = get(store);
		return (s.list || []).map((t) => ({ id: t.taskId, label: t.taskName }));
	}

	function getById(id: string) {
		return get(store).byId[id] ?? null;
	}

	// local optimistic helpers
	function addLocal(item: Task) {
		store.update((s) => {
			const list = [...s.list, item];
			const byId = { ...s.byId, [item.taskId]: item };
			return { ...s, list, byId };
		});
	}

	function updateLocal(id: string, patch: Partial<Task>) {
		store.update((s) => {
			const existing = s.byId[id];
			if (!existing) return s;
			const updated = { ...existing, ...patch };
			const list = s.list.map((x) => (x.taskId === id ? updated : x));
			const byId = { ...s.byId, [id]: updated };
			return { ...s, list, byId };
		});
	}

	function removeLocal(id: string) {
		store.update((s) => {
			const list = s.list.filter((x) => x.taskId !== id);
			const byId = { ...s.byId };
			delete byId[id];
			return { ...s, list, byId };
		});
	}

	// CRUD API calls
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
			const created = json?.data as any;
			const mappedTask = mapApiResponseToTask(created);

			// Replace temp with real task
			removeLocal(payload.taskId);
			if (mappedTask) addLocal(mappedTask);

			return mappedTask;
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
			const updated = json?.data as any;
			const mappedTask = mapApiResponseToTask(updated);
			if (mappedTask) updateLocal(id, mappedTask);

			return mappedTask;
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
