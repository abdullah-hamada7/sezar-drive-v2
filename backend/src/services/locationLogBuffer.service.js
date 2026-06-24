const prisma = require('../config/database');
const config = require('../config');

/** Batches location_log inserts to reduce write amplification. */
class LocationLogBuffer {
  constructor() {
    /** @type {Map<string, object[]>} */
    this.buffers = new Map();
    this.flushTimer = null;
  }

  start() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flushAll().catch((err) => {
        console.error('Location log flush error:', err.message);
      });
    }, config.locationLogBatchIntervalMs);
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  enqueue(entry) {
    const { driverId } = entry;
    if (!this.buffers.has(driverId)) {
      this.buffers.set(driverId, []);
    }
    const buf = this.buffers.get(driverId);
    buf.push(entry);

    if (buf.length >= config.locationLogBatchMaxSize) {
      return this.flushDriver(driverId);
    }
    return Promise.resolve();
  }

  async flushDriver(driverId) {
    const buf = this.buffers.get(driverId);
    if (!buf || buf.length === 0) return;

    this.buffers.set(driverId, []);
    await prisma.locationLog.createMany({ data: buf });
  }

  async flushAll() {
    const driverIds = [...this.buffers.keys()];
    await Promise.all(driverIds.map((id) => this.flushDriver(id)));
  }
}

module.exports = new LocationLogBuffer();
