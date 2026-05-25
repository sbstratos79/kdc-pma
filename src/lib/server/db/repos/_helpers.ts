// src/lib/server/db/repos/_helpers.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '$lib/server/db/queries/db';

export async function single<T>(promise: Promise<T[]>): Promise<T | null> {
	const rows = await promise;
	return rows[0] ?? null;
}

export async function insertAndFetch<TableSelect, TableInsert>(
	table: any,
	pkCol: string,
	values: TableInsert
): Promise<TableSelect | null> {
	const inserted = await db
		.insert(table)
		.values(values as any)
		.returning();
	if (Array.isArray(inserted) && inserted.length > 0) return inserted[0] as TableSelect;

	const pkValue = (values as any)[pkCol];
	if (!pkValue) return null;
	const rows = await db
		.select()
		.from(table)
		.where((t: any) => t[pkCol].equals(pkValue));
	return (rows as any[])[0] ?? null;
}
