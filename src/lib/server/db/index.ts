import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema.ts';

// HTTP driver: one stateless request per query, no connection pool to manage in serverless functions.
export const db = drizzle({ client: neon(DATABASE_URL), schema });
