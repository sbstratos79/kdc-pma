import { createEntityStore } from './_entityStore';
import type { Architect } from '$lib/types';

type CreatePayload = { architectId: string; architectName: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(api: any): Architect {
	return {
		architectId: api.architectId || api.id || '',
		architectName: api.architectName || api.name || '',
		tasks: api.tasks ?? []
	};
}

export const architectsStore = createEntityStore<Architect, CreatePayload>({
	endpoint: '/api/architects',
	getId: (a) => a.architectId,
	getLabel: (a) => a.architectName,
	mapItem,
	buildTemp: (p) => ({
		architectId: p.architectId,
		architectName: p.architectName,
		tasks: []
	})
});
