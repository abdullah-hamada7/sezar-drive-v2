const { loadSecrets } = require('../src/config/secrets');
const { execSync } = require('child_process');

async function repair() {
    console.log('--- Sezar Drive: Database Repair Tool ---');

    // 1. Ensure env is strictly production for secrets loading
    process.env.NODE_ENV = 'production';

    try {
        // 2. Load secrets from AWS to get DATABASE_URL
        await loadSecrets();

        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL not found in environment or AWS Secrets Manager');
        }

        const dbUrl = process.env.DATABASE_URL;
        const failedMigration = '20260222004200_fix_last_location_at';

        console.log(`\n[1/2] Attempting to resolve known blocker: ${failedMigration}`);
        try {
            execSync(`npx prisma migrate resolve --applied ${failedMigration}`, {
                env: { ...process.env, DATABASE_URL: dbUrl },
                stdio: 'inherit'
            });
            console.log('Successfully marked migration as resolved.');
        } catch {
            console.log('Note: Resolve skipped (likely already resolved or not needed).');
        }

        console.log(`\n[2/2] Deploying all pending migrations to catch up...`);
        try {
            execSync('npx prisma migrate deploy', {
                env: { ...process.env, DATABASE_URL: dbUrl },
                stdio: 'inherit'
            });
            console.log('\n✅ Database is now in sync with the codebase.');
        } catch (deployError) {
            console.error('\n❌ Deployment failed. Detailed error:');
            console.error(deployError.message);
            process.exit(1);
        }

    } catch (error) {
        console.error('\nCritical Repair Failure:', error.message);
        process.exit(1);
    }
}

repair();
