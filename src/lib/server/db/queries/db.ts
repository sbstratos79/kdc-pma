// src/lib/server/db/db.ts
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const url = process.env.DB_FILE_NAME!;

// createClient accepts an object with url
const client = createClient({
	url
});

// create drizzle instance using libsql adapter
export const db = drizzle(client);
