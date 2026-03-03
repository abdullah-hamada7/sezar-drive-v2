const express = require('express');
const trackingService = require('./tracking.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');

const router = express.Router();

// ─── POST /api/v1/tracking/location ───────────────
router.post(
  '/location',
  authenticate, enforcePasswordChanged, authorize('driver'),
  async (req, res, next) => {
    try {
      await trackingService.updateLocation(req.user.id, req.body, req.body.shiftId, req.body.tripId);
      res.json({ message: 'Location updated' });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/tracking/batch ──────────────────
router.post(
  '/batch',
  authenticate, enforcePasswordChanged, authorize('driver'),
  async (req, res, next) => {
    try {
      await trackingService.batchUpdateLocations(
        req.user.id, req.body.locations, req.body.shiftId, req.body.tripId
      );
      res.json({ message: 'Locations updated' });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/tracking/active ──────────────────
router.get(
  '/active',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const positions = await trackingService.getActiveDriverPositions();
      res.json(positions);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/tracking/history ─────────────────
router.get(
  '/history',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const history = await trackingService.getLocationHistory(req.query);
      res.json(history);
    } catch (err) { next(err); }
  }
);

module.exports = router;
