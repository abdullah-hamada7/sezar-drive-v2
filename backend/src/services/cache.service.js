const { createClient } = require('redis');
const config = require('../config');

const memoryStore = new Map();

let redisClient = null;
let redisReady = false;

function memoryGet(key) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key, value, ttlSeconds) {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function connect() {
  if (!config.redisUrl) {
    console.log('Redis URL not configured — using in-memory cache');
    return;
  }

  try {
    redisClient = createClient({ url: config.redisUrl });
    redisClient.on('error', (err) => {
      console.warn('Redis error:', err.message);
      redisReady = false;
    });
    await redisClient.connect();
    redisReady = true;
    console.log('✅ Redis cache connected');
  } catch (err) {
    console.warn('Redis unavailable, falling back to in-memory cache:', err.message);
    redisClient = null;
    redisReady = false;
  }
}

async function disconnect() {
  if (redisClient && redisReady) {
    try {
      await redisClient.quit();
    } catch (_) {
      /* ignore */
    }
  }
  redisClient = null;
  redisReady = false;
}

async function get(key) {
  if (redisReady && redisClient) {
    try {
      return await redisClient.get(key);
    } catch (_) {
      /* fall through */
    }
  }
  return memoryGet(key);
}

async function set(key, value, ttlSeconds) {
  if (redisReady && redisClient) {
    try {
      await redisClient.set(key, value, { EX: ttlSeconds });
      return;
    } catch (_) {
      /* fall through */
    }
  }
  memorySet(key, value, ttlSeconds);
}

async function getJson(key) {
  const raw = await get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function setJson(key, value, ttlSeconds) {
  await set(key, JSON.stringify(value), ttlSeconds);
}

async function getOrSet(key, ttlSeconds, factory) {
  const cached = await getJson(key);
  if (cached !== null) return cached;

  const value = await factory();
  await setJson(key, value, ttlSeconds);
  return value;
}

module.exports = {
  connect,
  disconnect,
  get,
  set,
  getJson,
  setJson,
  getOrSet,
};
