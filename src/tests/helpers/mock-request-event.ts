import type { RequestEvent } from '@sveltejs/kit';

export function mockRequestEvent(url: URL): RequestEvent {
	return { url } as unknown as RequestEvent;
}
