import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { v4 as uuidv4 } from 'uuid';

export default async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.JWT_EXPIRES_IN = '7d';
  
  // Create a unique test database name
  const testDbName = `test_db_${uuidv4().replace(/-/g, '_')}`;
  process.env.TEST_DB_NAME = testDbName;
  
  // Database connection details
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'username';
  const dbPassword = process.env.DB_PASSWORD || 'password';
  
  // Create test database
  const adminClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres', // Connect to default database to create test db
  });
  
  try {
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${testDbName}"`);
    console.log(`✅ Created test database: ${testDbName}`);
  } catch (error) {
    console.error('❌ Failed to create test database:', error);
    throw error;
  } finally {
    await adminClient.end();
  }
  
  // Set the test database URL
  process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${testDbName}`;
  
  // Run migrations on test database
  try {
    const migrationClient = postgres(process.env.DATABASE_URL);
    const db = drizzle(migrationClient);
    
    console.log('🔄 Running migrations on test database...');
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log('✅ Migrations completed successfully');
    
    await migrationClient.end();
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    throw error;
  }
}