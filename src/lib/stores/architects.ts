// src/lib/stores/architects.ts
import { writable, get, type Writable } from 'svelte/store';
import { createFetcher } from './_fetcher';
import type { Architect } from '$lib/types';

type State = {
  loading: boolean;
  error?: string | null;
  list: Architect[];
  byId: Record<string, Architect>;
};

const fetcher = createFetcher<Architect[]>('/api/architects', 5000); // 5seconds TTL

function makeInitial(): State {
  return { loading: false, error: null, list: [], byId: {} };
}

function createArchitectsStore() {
  const store: Writable<State> = writable(makeInitial());

  // Map API response to Architect DTO
  function mapApiResponseToArchitect(apiArchitect: any): Architect {
    return {
      architectId: apiArchitect.architectId || apiArchitect.id || '',
      architectName: apiArchitect.architectName || apiArchitect.name || ''
      // tasks: apiArchitect.tasks || []
    };
  }

  async function load(force = false) {
    store.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await fetcher.fetch(force);
      const rawData = Array.isArray(result) ? result : (result as any)?.data || [];
      const data = rawData.map(mapApiResponseToArchitect);
      const byId: Record<string, Architect> = {};
      data.forEach((a) => (byId[a.architectId] = a));
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
    return (s.list || []).map((a) => ({ id: a.architectId, label: a.architectName }));
  }

  function getById(id: string) {
    return get(store).byId[id] ?? null;
  }

  // local optimistic helpers
  function addLocal(item: Architect) {
    store.update((s) => {
      const list = [...s.list, item];
      const byId = { ...s.byId, [item.architectId]: item };
      return { ...s, list, byId };
    });
  }

  function updateLocal(id: string, patch: Partial<Architect>) {
    store.update((s) => {
      const existing = s.byId[id];
      if (!existing) return s;
      const updated = { ...existing, ...patch };
      const list = s.list.map((x) => (x.architectId === id ? updated : x));
      const byId = { ...s.byId, [id]: updated };
      return { ...s, list, byId };
    });
  }

  function removeLocal(id: string) {
    store.update((s) => {
      const list = s.list.filter((x) => x.architectId !== id);
      const byId = { ...s.byId };
      delete byId[id];
      return { ...s, list, byId };
    });
  }

  // CRUD API calls
  async function create(payload: { architectId: string; architectName: string }) {
    const temp: Architect = {
      architectId: payload.architectId,
      architectName: payload.architectName
      // tasks: []
    };

    addLocal(temp);

    try {
      const res = await fetch('/api/architects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Create architect failed');
      }
      const json = await res.json();
      const created = json?.data as any;
      const mappedArchitect = mapApiResponseToArchitect(created);

      // Replace temp with real architect
      removeLocal(payload.architectId);
      if (mappedArchitect) addLocal(mappedArchitect);

      return mappedArchitect;
    } catch (err) {
      removeLocal(payload.architectId);
      throw err;
    }
  }

  async function update(id: string, changes: Partial<Architect>) {
    const before = getById(id);
    updateLocal(id, changes);

    try {
      const res = await fetch('/api/architects', {
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
      const mappedArchitect = mapApiResponseToArchitect(updated);
      if (mappedArchitect) updateLocal(id, mappedArchitect);
      return mappedArchitect;
    } catch (err) {
      if (before) updateLocal(id, before);
      throw err;
    }
  }

  async function remove(id: string) {
    const before = getById(id);
    removeLocal(id);

    try {
      const res = await fetch('/api/architects', {
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

export const architectsStore = createArchitectsStore();
