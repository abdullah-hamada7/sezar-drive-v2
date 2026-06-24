const express = require('express');
const router = express.Router();
const config = require('../../config');
const pushService = require('../../services/push.service');
const fcmService = require('../../services/fcm.service');
const { authenticate, enforcePasswordChanged } = require('../../middleware/auth');
const { body, validationResult } = require('express-validator');

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.details = errors.array();
    throw err;
  }
}

// GET /api/v1/push/vapid-key
router.get('/vapid-key', authenticate, enforcePasswordChanged, (req, res, next) => {
  try {
    res.json({ publicKey: config.vapid.publicKey });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/push/subscribe
router.post('/subscribe', authenticate, enforcePasswordChanged, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ error: { message: 'Subscription data is required' } });
    }

    const saved = await pushService.saveSubscription(req.user.id, subscription);
    res.status(201).json({ success: true, subscription: saved });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/push/unsubscribe
router.post('/unsubscribe', authenticate, enforcePasswordChanged, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: { message: 'Endpoint is required' } });
    }

    await pushService.removeSubscription(endpoint);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/push/register-device — FCM token for mobile
router.post(
  '/register-device',
  authenticate,
  enforcePasswordChanged,
  [
    body('token').isString().trim().notEmpty(),
    body('platform').optional().isIn(['android', 'ios', 'ANDROID', 'IOS']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const platform = String(req.body.platform || 'android').toLowerCase();
      const saved = await fcmService.saveToken(req.user.id, req.body.token, platform);
      res.status(201).json({ success: true, token: saved });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/push/unregister-device — remove FCM token on logout
router.post(
  '/unregister-device',
  authenticate,
  [
    body('token').isString().trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      await fcmService.removeToken(req.body.token);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
