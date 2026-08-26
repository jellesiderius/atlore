import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../src/lib/server/db/index.js';

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.info('Atlore database is bijgewerkt.');
} finally {
  await pool.end();
}
