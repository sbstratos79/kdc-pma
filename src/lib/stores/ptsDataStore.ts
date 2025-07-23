// lib/stores/dataStore.ts
import type { PTSApiResponse } from '$lib/types';
import { writable } from 'svelte/store';

function createPTSDataStore() {
  const { subscribe, set, update } = writable<PTSApiResponse | null>(null);
  let intervalId: NodeJS.Timeout | null = null;

  return {
    subscribe,
    init: (initialData: PTSApiResponse) => {
      set(initialData);
    },
    startPolling: async (intervalMs: number = 30000) => {
      if (intervalId) clearInterval(intervalId);

      intervalId = setInterval(async () => {
        try {
          const response = await fetch('/api/pts');

          console.log(response);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const newData: PTSApiResponse = await response.json();
          set(newData);
        } catch (error) {
          console.error('Failed to refresh PTS data:', error);
          // Optionally handle error state
        }
      }, intervalMs);
    },
    stopPolling: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  };
}

export const ptsDataStore = createPTSDataStore();

// For cleaner reactive access, create derived stores
import { derived } from 'svelte/store';

// Derived stores for easier access
export const architectData = derived(ptsDataStore, ($store) => $store?.architectDataValues ?? []);

export const projectData = derived(ptsDataStore, ($store) => $store?.projectDataValues ?? []);

export const statusOptions = derived(ptsDataStore, ($store) => $store?.status ?? []);

export const priorityOptions = derived(ptsDataStore, ($store) => $store?.priority ?? []);
