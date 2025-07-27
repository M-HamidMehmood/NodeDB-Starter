import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { client, db } from './connection';

async function runMigrations(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('🚀 Running database migrations...');

    await migrate(db, {
      migrationsFolder: './src/db/migrations',
    });

    // eslint-disable-next-line no-console
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('🎉 Migration process completed!');
      process.exit(0);
    })
    .catch(error => {
      // eslint-disable-next-line no-console
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { runMigrations };
export default runMigrations;
