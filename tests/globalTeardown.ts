import { Client } from 'pg';

export default async function globalTeardown() {
  const testDbName = process.env.TEST_DB_NAME;
  
  if (!testDbName) {
    console.log('⚠️ No test database name found, skipping cleanup');
    return;
  }
  
  // Database connection details
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'username';
  const dbPassword = process.env.DB_PASSWORD || 'password';
  
  // Drop test database
  const adminClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres',
  });
  
  try {
    await adminClient.connect();
    
    // Terminate all connections to the test database
    await adminClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [testDbName]);
    
    // Drop the test database
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    console.log(`✅ Cleaned up test database: ${testDbName}`);
  } catch (error) {
    console.error('❌ Failed to cleanup test database:', error);
  } finally {
    await adminClient.end();
  }
}