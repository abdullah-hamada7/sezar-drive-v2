const express = require('express');
const router = express.Router();
const config = require('../../config');
const pushService = require('../../services/push.service');
const { authenticate, enforcePasswordChanged } = require('../../middleware/auth');

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

module.exports = router;
