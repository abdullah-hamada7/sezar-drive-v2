const express = require('express');
const router = express.Router();
const statsService = require('./stats.service');
const { authenticate, authorize } = require('../../middleware/auth');

// GET /api/v1/stats/revenue
router.get('/revenue', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const data = await statsService.getRevenueStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/activity
router.get('/activity', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const data = await statsService.getActivityStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-revenue
router.get('/my-revenue', authenticate, authorize('driver'), async (req, res, next) => {
  try {
    const data = await statsService.getDriverWeeklyStats(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-daily-revenue
router.get('/my-daily-revenue', authenticate, authorize('driver'), async (req, res, next) => {
  try {
    const data = await statsService.getDriverDailyStats(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});


// GET /api/v1/stats/summary
router.get('/summary', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const data = await statsService.getSummaryStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-shift
router.get('/my-shift', authenticate, authorize('driver'), async (req, res, next) => {
  try {
    const data = await statsService.getDriverShiftStats(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-activity
router.get('/my-activity', authenticate, authorize('driver'), async (req, res, next) => {
  try {
    const data = await statsService.getDriverActivity(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

