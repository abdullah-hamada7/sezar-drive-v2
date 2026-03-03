const crypto = require('crypto');

const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now) {
      responseCache.delete(key);
    }
  }
}

function buildCacheKey(req, rawKey) {
  const userPart = req.user?.id || 'anonymous';
  const fingerprint = crypto
    .createHash('sha1')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');
  return `${userPart}:${req.method}:${req.originalUrl}:${rawKey}:${fingerprint}`;
}

function requireIdempotencyKey(req, res, next) {
  const rawKey = req.get('Idempotency-Key');
  if (!rawKey) {
    return res.status(400).json({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header is required for this endpoint',
      },
    });
  }

  cleanupExpired();
  const cacheKey = buildCacheKey(req, rawKey);
  const cached = responseCache.get(cacheKey);

  if (cached) {
    return res.status(cached.statusCode).json(cached.payload);
  }

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    responseCache.set(cacheKey, {
      statusCode: res.statusCode,
      payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return originalJson(payload);
  };

  return next();
}

module.exports = {
  requireIdempotencyKey,
};
