import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/myapp_db', {
  max: Number(process.env.DB_POOL_MAX) || 10,
  idle_timeout: Number(process.env.DB_POOL_IDLE) || 10000,
  connect_timeout: Number(process.env.DB_POOL_ACQUIRE) || 30000,
});

export const db = drizzle(client, { schema });
export { client };
