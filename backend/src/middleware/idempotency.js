const crypto = require('crypto');
const cache = require('../services/cache.service');

const CACHE_TTL_SEC = 5 * 60;

function buildCacheKey(req, rawKey) {
  const userPart = req.user?.id || 'anonymous';
  const fingerprint = crypto
    .createHash('sha1')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');
  return `idempotency:${userPart}:${req.method}:${req.originalUrl}:${rawKey}:${fingerprint}`;
}

async function requireIdempotencyKey(req, res, next) {
  const rawKey = req.get('Idempotency-Key');
  if (!rawKey) {
    return res.status(400).json({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header is required for this endpoint',
      },
    });
  }

  const cacheKey = buildCacheKey(req, rawKey);
  const cached = await cache.getJson(cacheKey);

  if (cached) {
    return res.status(cached.statusCode).json(cached.payload);
  }

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    cache.setJson(cacheKey, {
      statusCode: res.statusCode,
      payload,
    }, CACHE_TTL_SEC).catch(() => {});
    return originalJson(payload);
  };

  return next();
}

module.exports = {
  requireIdempotencyKey,
};
