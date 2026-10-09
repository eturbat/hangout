import { DataSource } from 'typeorm';
import { loadEnvFile } from '../env';

// Helpers for the integration tests (*.e2e-spec.ts), which need Postgres running.
// They use their own database ("hangout_test" by default), so your development
// data in "hangout" is never touched.

// TEST_DATABASE_URL if set; otherwise DATABASE_URL with "_test" added to the
// database name (only once, even if a previous test file already switched to it)
export function testDatabaseUrl(): URL {
  const configured = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!configured) {
    throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  const url = new URL(configured);
  if (!process.env.TEST_DATABASE_URL && !url.pathname.endsWith('_test')) {
    url.pathname = `${url.pathname}_test`;
  }
  return url;
}

// Creates the test database the first time, through Postgres's built-in "postgres" database
async function createDatabaseIfMissing(url: URL): Promise<void> {
  const name = url.pathname.slice(1);
  if (!/^\w+$/.test(name)) throw new Error(`Unexpected test database name: "${name}"`);

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  const admin = new DataSource({ type: 'postgres', url: adminUrl.toString() });
  await admin.initialize();
  try {
    const existing: unknown[] = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.length === 0) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.destroy();
  }
}

// Points DATABASE_URL at the test database, creating it the first time.
// Call this before building the Nest app: AppModule reads DATABASE_URL while starting.
export async function useTestDatabase(): Promise<void> {
  loadEnvFile();
  const url = testDatabaseUrl();
  await createDatabaseIfMissing(url);
  process.env.DATABASE_URL = url.toString();
}
