import type { Handle } from '@sveltejs/kit';

const AUTH_COOKIE = 'auth';

export const handle: Handle = async ({ event, resolve }) => {
	const authCookie = event.cookies.get(AUTH_COOKIE);

	if (authCookie === '1') {
		event.locals.authenticated = true;
	} else {
		event.locals.authenticated = false;
	}

	// Protect mutation API endpoints
	if (!event.locals.authenticated) {
		const url = new URL(event.request.url);
		const isMutationMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method);
		const isProtectedApi = /^\/api\/(architects|projects|tasks)(\/|$)/.test(url.pathname);

		if (isMutationMethod && isProtectedApi) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
	}

	return resolve(event);
};
