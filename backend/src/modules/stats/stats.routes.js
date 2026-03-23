const express = require('express');
const router = express.Router();
const statsService = require('./stats.service');
const { query } = require('express-validator');
const { validationResult } = require('express-validator');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');
const PDFDocument = require('pdfkit');

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

// GET /api/v1/stats/daily-report (all drivers)
router.get(
  '/daily-report',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [query('date').optional().isISO8601()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = await statsService.getAllDriversDailyReport(req.query.date);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/stats/my-daily-report (single driver)
router.get(
  '/my-daily-report',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [query('date').optional().isISO8601()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = await statsService.getDriverDailyReport(req.user.id, req.query.date);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/stats/cash-exceptions (uncollected CASH trips)
router.get(
  '/cash-exceptions',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [query('date').optional().isISO8601()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = await statsService.getCashExceptions(req.query.date);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/stats/cash-exceptions.pdf (simple PDF summary)
router.get(
  '/cash-exceptions.pdf',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [query('date').optional().isISO8601()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = await statsService.getCashExceptions(req.query.date);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="cash-exceptions-${data.date}.pdf"`);

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      doc.pipe(res);

      doc.fontSize(16).text('Cash Exceptions (Uncollected CASH trips)', { align: 'left' });
      doc.moveDown(0.25);
      doc.fontSize(11).fillColor('#555').text(`Date: ${data.date}`);
      doc.fillColor('#000');
      doc.moveDown(0.5);

      doc.fontSize(12).text(`Total trips: ${data.totalUncollectedCashTripsCount}`);
      doc.fontSize(12).text(`Total uncollected: ${Number(data.totalUncollectedCashTotal || 0).toFixed(2)}`);
      doc.moveDown(0.75);

      const drivers = Array.isArray(data.drivers) ? data.drivers : [];
      for (const driver of drivers) {
        doc.fontSize(12).text(`${driver.driverName} - ${driver.uncollectedCashTripsCount} trips - ${Number(driver.uncollectedCashTotal || 0).toFixed(2)}`);
        doc.moveDown(0.25);

        const trips = Array.isArray(driver.trips) ? driver.trips : [];
        for (const trip of trips.slice(0, 12)) {
          const ended = trip.actualEndTime ? new Date(trip.actualEndTime).toISOString() : '—';
          const plate = trip.vehiclePlateNumber ? ` (${trip.vehiclePlateNumber})` : '';
          doc.fontSize(9)
            .fillColor('#333')
            .text(`- ${String(trip.id).slice(0, 8)} | ${ended} | ${Number(trip.price || 0).toFixed(2)}${plate}`);
        }

        if (trips.length > 12) {
          doc.fontSize(9).fillColor('#777').text(`  ... and ${trips.length - 12} more`);
        }

        doc.fillColor('#000');
        doc.moveDown(0.5);

        if (doc.y > 740) {
          doc.addPage();
        }
      }

      doc.end();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

