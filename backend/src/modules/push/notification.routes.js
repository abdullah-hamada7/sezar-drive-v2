const express = require('express');
const router = express.Router();
const notificationService = require('../../services/notification.service');
const { authenticate, enforcePasswordChanged } = require('../../middleware/auth');

// All routes require auth
router.use(authenticate, enforcePasswordChanged);

// GET /api/v1/notifications
// Returns paginated notifications + total + unseenCount
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Number(req.query.offset) || 0;

    const result = await notificationService.getNotifications(req.user.id, { limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notifications/unseen-count
// Lightweight endpoint for the badge counter
router.get('/unseen-count', async (req, res, next) => {
  try {
    const count = await notificationService.getUnseenCount(req.user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/mark-all-read
// Marks all notifications for the requesting user as read
router.patch('/mark-all-read', async (req, res, next) => {
  try {
    const updated = await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/mark-read
// Marks specific notification IDs as read
router.patch('/mark-read', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { message: 'ids array is required' } });
    }
    const updated = await notificationService.markAsRead(req.user.id, ids);
    res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
