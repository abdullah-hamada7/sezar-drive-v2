require('dotenv').config();

function isTruthyEnv(name) {
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env[name] || '').toLowerCase());
}

/**
 * Main application entry point
 */
async function startServer() {
  try {
    const { execSync } = require('child_process');
    const appCwd = process.env.APP_CWD || process.cwd();

    // 2. Optionally run database migrations
    if (isTruthyEnv('RUN_MIGRATIONS_ON_STARTUP')) {
      try {
        console.log('Running database migrations...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: appCwd });
        console.log('✅ Migrations applied successfully');
      } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error('\n' + '='.repeat(50));
        console.error('DATABASE MIGRATION ERROR DETECTED');
        console.error('This often happens due to a previously failed migration (P3009).');
        console.error('To fix this permanently, run the following on the server:');
        console.error('npm run db:repair');
        console.error('='.repeat(50) + '\n');

        // In production, we might want to prevent startup if migrations are blocked
        // But for now, we just log clearly.
      }
    }

    // 3. Load dependencies after env is ready
    const http = require('http');
    const app = require('./app');
    const config = require('./config');
    const prisma = require('./config/database');
    const { initWebSocketServer } = require('./modules/tracking/tracking.ws');

    // 4. Explicitly connect to database with retries
    let connected = false;
    let retries = 5;
    while (!connected && retries > 0) {
      try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
        connected = true;
      } catch (err) {
        retries -= 1;
        console.error(`❌ Database connection failed (${err.message}). Retries left: ${retries}`);
        if (retries === 0) throw err;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // 5. Optionally run seed (recommended: run once, manually)
    if (isTruthyEnv('RUN_SEED_ON_STARTUP')) {
      try {
        console.log('RUN_SEED_ON_STARTUP enabled — running seed...');
        execSync('npm run seed', { stdio: 'inherit', cwd: appCwd });
        console.log('✅ Seed completed successfully');
      } catch (err) {
        console.error('❌ Seed failed:', err.message);
      }
    }

    // 3. Create Server
    const server = http.createServer(app);

    // 4. Initialize WebSocket
    initWebSocketServer(server);

    // 5. Start Listening
    server.listen(config.port, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║  Fleet Management API Server                     ║
║  Environment: ${config.nodeEnv.padEnd(35)}║
║  Port: ${String(config.port).padEnd(42)}║
║  API: http://localhost:${config.port}/api/v1${' '.repeat(17)}║
║  WebSocket: ws://localhost:${config.port}/ws/tracking${' '.repeat(8)}║
╚══════════════════════════════════════════════════╝
      `);
    });

    // Handle graceful shutdown
    setupGracefulShutdown(server, prisma);

  } catch (error) {
    console.error('FAILED TO START SERVER:', error);
    process.exit(1);
  }
}

/**
 * Setup process signal handlers for graceful shutdown
 */
function setupGracefulShutdown(server, prisma) {
  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed.');
      Promise.resolve()
        .then(() => prisma?.$disconnect?.())
        .catch(() => { })
        .finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Kick off the server
startServer();
