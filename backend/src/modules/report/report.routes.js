const express = require('express');
const { query } = require('express-validator');
const { validationResult } = require('express-validator');
const reportService = require('./report.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const AuditService = require('../../services/audit.service');
const { ValidationError } = require('../../errors');

const router = express.Router();

// Validation helper
function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
}

const dateValidation = [
  query('startDate').isISO8601().withMessage('Valid start date is required (ISO8601)'),
  query('endDate').isISO8601().withMessage('Valid end date is required (ISO8601)'),
  query('driverId').optional().isUUID().withMessage('Invalid driver ID format'),
];

// ─── GET /api/v1/reports/revenue ──────────────────
router.get(
  '/revenue',
  authenticate, enforcePasswordChanged, authorize('admin'),
  dateValidation,
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = await reportService.generateRevenueData(req.query);
      res.json(data);
    } catch (err) {
      console.error('[REPORT_ERROR] Revenue Data Generation failed:', err);
      next(err);
    }
  }
);

// ─── GET /api/v1/reports/revenue/pdf ──────────────
router.get(
  '/revenue/pdf',
  authenticate, enforcePasswordChanged, authorize('admin'),
  dateValidation,
  async (req, res, next) => {
    try {
      handleValidation(req);
      console.log('[REPORT_LOG] Generating PDF for range:', req.query.startDate, 'to', req.query.endDate);
      const data = await reportService.generateRevenueData(req.query);
      await AuditService.log({
        actorId: req.user.id,
        actionType: 'report.generated',
        entityType: 'report',
        entityId: req.user.id,
        newState: { format: 'pdf', startDate: req.query.startDate, endDate: req.query.endDate },
        ipAddress: req.clientIp,
      });
      await reportService.generatePDF(data, res, { lang: req.query.lang });
    } catch (err) {
      console.error('[REPORT_ERROR] PDF Generation failed:', err);
      next(err);
    }
  }
);

// ─── GET /api/v1/reports/revenue/excel ────────────
router.get(
  '/revenue/excel',
  authenticate, enforcePasswordChanged, authorize('admin'),
  dateValidation,
  async (req, res, next) => {
    try {
      handleValidation(req);
      console.log('[REPORT_LOG] Generating Excel for range:', req.query.startDate, 'to', req.query.endDate);
      const data = await reportService.generateRevenueData(req.query);
      await AuditService.log({
        actorId: req.user.id,
        actionType: 'report.generated',
        entityType: 'report',
        entityId: req.user.id,
        newState: { format: 'excel', startDate: req.query.startDate, endDate: req.query.endDate },
        ipAddress: req.clientIp,
      });
      await reportService.generateExcel(data, res, { lang: req.query.lang });
    } catch (err) {
      console.error('[REPORT_ERROR] Excel Generation failed:', err);
      next(err);
    }
  }
);

module.exports = router;
