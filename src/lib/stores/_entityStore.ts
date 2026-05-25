import { writable, get, type Writable } from 'svelte/store';
import { createFetcher } from './_fetcher';

export type EntityState<T> = {
	loading: boolean;
	error?: string | null;
	list: T[];
	byId: Record<string, T>;
};

interface StoreConfig<T, TCreatePayload> {
	endpoint: string;
	mapItem: (api: unknown) => T;
	getId: (item: T) => string;
	getLabel: (item: T) => string;
	buildTemp: (payload: TCreatePayload) => T;
	ttl?: number;
}

export function createEntityStore<T, TCreatePayload>(config: StoreConfig<T, TCreatePayload>) {
	const { endpoint, mapItem, getId, getLabel, buildTemp, ttl = 5000 } = config;
	const fetcher = createFetcher<T[]>(endpoint, ttl);
	const store: Writable<EntityState<T>> = writable(makeInitial());

	function makeInitial(): EntityState<T> {
		return { loading: false, error: null, list: [], byId: {} };
	}

	async function load(force = false) {
		store.update((s) => ({ ...s, loading: true, error: null }));
		try {
			const result = await fetcher.fetch(force);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rawData = Array.isArray(result) ? result : (result as any)?.data || [];
			const data = rawData.map(mapItem);
			const byId: Record<string, T> = {};
			data.forEach((item: T) => (byId[getId(item)] = item));
			store.set({ loading: false, error: null, list: data, byId });
			return data;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			store.update((s) => ({ ...s, loading: false, error: msg }));
			throw err;
		}
	}

	function options() {
		return get(store).list.map((item) => ({ id: getId(item), label: getLabel(item) }));
	}

	function getById(id: string) {
		return get(store).byId[id] ?? null;
	}

	function addLocal(item: T) {
		store.update((s) => {
			const id = getId(item);
			return { ...s, list: [...s.list, item], byId: { ...s.byId, [id]: item } };
		});
	}

	function updateLocal(id: string, patch: Partial<T>) {
		store.update((s) => {
			const existing = s.byId[id];
			if (!existing) return s;
			const updated = { ...existing, ...patch };
			return {
				...s,
				list: s.list.map((x) => (getId(x) === id ? updated : x)),
				byId: { ...s.byId, [id]: updated }
			};
		});
	}

	function removeLocal(id: string) {
		store.update((s) => {
			const byId = { ...s.byId };
			delete byId[id];
			return { ...s, list: s.list.filter((x) => getId(x) !== id), byId };
		});
	}

	async function create(payload: TCreatePayload) {
		const temp = buildTemp(payload);
		addLocal(temp);

		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Create failed');
			}
			const json = await res.json();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const created = json?.data as any;
			const mapped = mapItem(created);

			removeLocal(getId(temp));
			if (mapped) addLocal(mapped);

			return mapped;
		} catch (err) {
			removeLocal(getId(temp));
			throw err;
		}
	}

	async function update(id: string, changes: Partial<T>) {
		const before = getById(id);
		updateLocal(id, changes);

		try {
			const res = await fetch(endpoint, {
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
			const res = await fetch(endpoint, {
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
