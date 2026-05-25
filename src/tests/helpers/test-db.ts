// src/tests/helpers/test-db.ts
//
// Creates a temporary file-based SQLite DB for testing.
//
// WHY NOT file::memory:?
// @libsql/client's interactive-transaction mode leaves the in-memory connection
// in a broken state after db.transaction() completes, causing all subsequent
// queries in the same process to throw "Failed query".  A temp file with a
// unique name per process avoids this entirely.
//
// Each test FILE gets its own process (pool:'forks' in vitest.config.ts), so
// each gets a completely isolated DB — no cross-file leakage.

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { architects, projects, tasks } from '$lib/server/db/schema';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';

// Unique path per process — each fork gets its own file.
const dbPath = join(tmpdir(), `vitest-${randomUUID()}.db`);
export const testClient = createClient({ url: `file:${dbPath}` });
export const testDb = drizzle(testClient);

// DDL that mirrors schema.ts exactly.
const STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS architects (
    architect_id TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    email        TEXT,
    phone_number INTEGER
  )`,

	`CREATE UNIQUE INDEX IF NOT EXISTS architects_phone_number_unique
     ON architects(phone_number)`,

	`CREATE UNIQUE INDEX IF NOT EXISTS architects_email_unique
     ON architects(email)`,

	`CREATE TABLE IF NOT EXISTS projects (
    project_id  TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    start_date  TEXT,
    due_date    TEXT,
    added_time  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    status      TEXT NOT NULL,
    priority    TEXT NOT NULL,
    CHECK (status   IN ('Planning','In Progress','Completed','On Hold','Cancelled')),
    CHECK (priority IN ('High','Medium','Low'))
  )`,

	`CREATE TABLE IF NOT EXISTS tasks (
    task_id      TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    start_date   TEXT,
    due_date     TEXT,
    added_time   TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    status       TEXT NOT NULL,
    priority     TEXT NOT NULL,
    architect_id TEXT REFERENCES architects(architect_id)
                      ON DELETE SET NULL ON UPDATE CASCADE,
    project_id   TEXT NOT NULL REFERENCES projects(project_id)
                      ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (status   IN ('Planning','In Progress','Completed','On Hold','Cancelled')),
    CHECK (priority IN ('High','Medium','Low'))
  )`
];

/**
 * Run DDL and enable FK enforcement.
 * Call once in beforeAll.
 *
 * PRAGMA foreign_keys must be ON for ON DELETE CASCADE and ON DELETE SET NULL
 * to fire — SQLite ignores FK constraints by default.
 */
export async function setupSchema(): Promise<void> {
	await testClient.execute('PRAGMA foreign_keys = ON');
	for (const stmt of STATEMENTS) {
		await testClient.execute(stmt);
	}
}

/** Wipe all rows in FK-safe order (leaf tables first). Call in beforeEach. */
export async function clearTables(): Promise<void> {
	await testDb.delete(tasks);
	await testDb.delete(projects);
	await testDb.delete(architects);
}

/** Close the connection and delete the temp DB file. Call in afterAll. */
export async function closeDb(): Promise<void> {
	await testClient.close();
	try {
		unlinkSync(dbPath);
	} catch {
		/* already gone */
	}
}
