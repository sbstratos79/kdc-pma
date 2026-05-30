import { architectsStore, projectsStore, tasksStore } from '$lib/stores';

let eventSource: EventSource | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

export function connectEntitySSE() {
	if (typeof window === 'undefined') return;
	if (eventSource) return;

	eventSource = new EventSource('/api/entities/stream');

	eventSource.onmessage = (event) => {
		const msg = JSON.parse(event.data);
		if (msg.type === 'change') {
			if (msg.entity === 'architects') architectsStore.refresh();
			if (msg.entity === 'projects') projectsStore.refresh();
			if (msg.entity === 'tasks') tasksStore.load(true, true);
		}
	};

	eventSource.onerror = () => {
		eventSource?.close();
		eventSource = null;
		reconnectTimeout = setTimeout(connectEntitySSE, 5000);
	};
}

export function disconnectEntitySSE() {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}
	eventSource?.close();
	eventSource = null;
}
