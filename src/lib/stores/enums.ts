// src/lib/stores/enums.ts
import { derived, writable } from 'svelte/store';
import { createFetcher } from './_fetcher';

const fetcher = createFetcher<{ status: string[]; priority: string[] }>('/api/meta', 30 * 60_1000);
const base = writable<{
  loading: boolean;
  value?: { status: string[]; priority: string[] };
  error?: string | null;
}>({ loading: false });

export const enumsStore = {
  subscribe: base.subscribe,
  load: async (force = false) => {
    base.update((s) => ({ ...s, loading: true }));
    try {
      const v = await fetcher.fetch(force);
      base.set({ loading: false, value: v });
    } catch (err) {
      base.set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },
  options: derived(base, ($b) => {
    const st = $b.value?.status ?? [];
    const pr = $b.value?.priority ?? [];
    return {
      statusOptions: [{ id: 'all', label: 'All Status' }, ...st.map((s) => ({ id: s, label: s }))],
      priorityOptions: [
        { id: 'all', label: 'All Priorities' },
        ...pr.map((p) => ({ id: p, label: p }))
      ]
    };
  })
};
