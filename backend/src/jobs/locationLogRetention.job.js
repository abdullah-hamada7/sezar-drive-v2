const prisma = require('../config/database');
const config = require('../config');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let retentionTimer = null;

async function purgeOldLocationLogs() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.locationLogRetentionDays);

  const result = await prisma.locationLog.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    console.log(`[retention] Deleted ${result.count} location_logs older than ${config.locationLogRetentionDays} days`);
  }
}

function startSchedule() {
  if (retentionTimer) return;

  // Run once shortly after startup, then daily.
  setTimeout(() => {
    purgeOldLocationLogs().catch((err) => {
      console.error('[retention] Initial purge failed:', err.message);
    });
  }, 60_000);

  retentionTimer = setInterval(() => {
    purgeOldLocationLogs().catch((err) => {
      console.error('[retention] Scheduled purge failed:', err.message);
    });
  }, ONE_DAY_MS);
}

function stopSchedule() {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
}

module.exports = {
  purgeOldLocationLogs,
  startSchedule,
  stopSchedule,
};
