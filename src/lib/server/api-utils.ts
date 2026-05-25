import { json } from '@sveltejs/kit';
import type { ReportFilters } from '$lib/server/db/repos/reports.repo';

export class AppError extends Error {
	constructor(
		message: string,
		public status: number = 500
	) {
		super(message);
		this.name = 'AppError';
	}
}

type HandlerFn = () => Promise<Response>;

export async function catchHandler(handler: HandlerFn, errorMessage: string): Promise<Response> {
	try {
		return await handler();
	} catch (err) {
		console.error(`${errorMessage}:`, err);
		if (err instanceof AppError) {
			return json({ error: err.message }, { status: err.status });
		}
		return json({ error: errorMessage }, { status: 500 });
	}
}

export function extractFilters(url: URL): ReportFilters {
	return {
		dateFrom: url.searchParams.get('dateFrom') || null,
		dateTo: url.searchParams.get('dateTo') || null,
		architectId: url.searchParams.get('architectId') || null,
		status: url.searchParams.get('status') || null,
		priority: url.searchParams.get('priority') || null,
		search: url.searchParams.get('search') || null
	};
}

export function isValidDate(dateString: string | null | undefined): boolean {
	if (!dateString) return true;
	const d = new Date(dateString);
	return !isNaN(d.getTime());
}
