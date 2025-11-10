// normalize .returning() results
export async function single<T>(promise: Promise<T[]>): Promise<T | null> {
	const rows = await promise;
	return rows[0] ?? null;
}
