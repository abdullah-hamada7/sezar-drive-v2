const crypto = require('crypto');
const { createClient } = require('redis');
const config = require('../config');

const INSTANCE_ID = crypto.randomUUID();
const CHANNEL = 'sezar:ws:relay';

let publisher = null;
let subscriber = null;
let deliverToAdmins = null;
let deliverToDriver = null;

async function connect() {
  if (!config.redisUrl) {
    console.log('WebSocket relay: Redis not configured — local instance only');
    return;
  }

  try {
    publisher = createClient({ url: config.redisUrl });
    subscriber = publisher.duplicate();

    publisher.on('error', (err) => console.warn('WS relay publisher error:', err.message));
    subscriber.on('error', (err) => console.warn('WS relay subscriber error:', err.message));

    await publisher.connect();
    await subscriber.connect();

    await subscriber.subscribe(CHANNEL, (raw) => {
      try {
        const payload = JSON.parse(raw);
        if (payload.instanceId === INSTANCE_ID) return;

        if (payload.target === 'admin' && deliverToAdmins) {
          deliverToAdmins(payload.message);
        } else if (payload.target === 'driver' && payload.userId && deliverToDriver) {
          deliverToDriver(payload.userId, payload.message);
        }
      } catch (err) {
        console.warn('WS relay message parse error:', err.message);
      }
    });

    console.log('✅ WebSocket Redis relay connected');
  } catch (err) {
    console.warn('WebSocket relay unavailable, local delivery only:', err.message);
    publisher = null;
    subscriber = null;
  }
}

async function disconnect() {
  const tasks = [];
  if (subscriber) tasks.push(subscriber.quit().catch(() => {}));
  if (publisher) tasks.push(publisher.quit().catch(() => {}));
  await Promise.all(tasks);
  subscriber = null;
  publisher = null;
}

function registerLocalDelivery(handlers) {
  deliverToAdmins = handlers.deliverToAdmins;
  deliverToDriver = handlers.deliverToDriver;
}

function publishRelay(payload) {
  if (!publisher?.isOpen) return;
  publisher.publish(CHANNEL, JSON.stringify({ ...payload, instanceId: INSTANCE_ID }))
    .catch((err) => console.warn('WS relay publish failed:', err.message));
}

function broadcastToAdmins(message) {
  if (deliverToAdmins) deliverToAdmins(message);
  publishRelay({ target: 'admin', message });
}

function notifyAdmins(type, title, message, data = {}) {
  broadcastToAdmins({
    type: 'notification',
    payload: {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      data,
      timestamp: new Date().toISOString(),
    },
  });
}

function notifyDriver(userId, data) {
  if (deliverToDriver) deliverToDriver(userId, data);
  publishRelay({ target: 'driver', userId, message: data });
}

module.exports = {
  connect,
  disconnect,
  registerLocalDelivery,
  broadcastToAdmins,
  notifyAdmins,
  notifyDriver,
};
