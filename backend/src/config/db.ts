import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { databaseUrl } from './env';

if (!databaseUrl) {
  throw new Error('Set DATABASE_URL in backend/.env or in the process environment.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
});

pool.on('error', () => {
  console.error('An idle PostgreSQL connection failed.');
});

export const db = drizzle(pool, { schema });
