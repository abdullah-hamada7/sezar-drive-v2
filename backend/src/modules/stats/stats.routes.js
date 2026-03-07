const express = require('express');
const router = express.Router();
const statsService = require('./stats.service');
const { query } = require('express-validator');
const { validationResult } = require('express-validator');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// GET /api/v1/stats/revenue
router.get('/revenue', authenticate, enforcePasswordChanged, authorize('admin'), async (req, res, next) => {
  try {
    const data = await statsService.getRevenueStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/activity
router.get('/activity', authenticate, enforcePasswordChanged, authorize('admin'), async (req, res, next) => {
  try {
    const data = await statsService.getActivityStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-revenue
router.get('/my-revenue', authenticate, enforcePasswordChanged, authorize('driver'), async (req, res, next) => {
  try {
    const data = await statsService.getDriverWeeklyStats(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-daily-revenue
router.get('/my-daily-revenue', authenticate, enforcePasswordChanged, authorize('driver'), async (req, res, next) => {
  try {
    const data = await statsService.getDriverDailyStats(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});


// GET /api/v1/stats/summary
router.get('/summary', authenticate, enforcePasswordChanged, authorize('admin'), async (req, res, next) => {
  try {
    const data = await statsService.getSummaryStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-shift
router.get('/my-shift', authenticate, enforcePasswordChanged, authorize('driver'), async (req, res, next) => {
  try {
    const data = await statsService.getDriverShiftStats(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/my-activity
router.get(
  '/my-activity',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [query('limit').optional().isInt({ min: 1, max: 50 }).toInt()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = await statsService.getDriverActivity(req.user.id, req.query.limit);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

