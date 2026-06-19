const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const driverService = require('./driver.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');
const { EMAIL_REGEX, EGYPT_PHONE_REGEX } = require('../../utils/validation');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const upload = createUploader();
const { sendCsv } = require('../../utils/csv');
const prisma = require('../../config/database');

const router = express.Router();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// Valid tab names — matches the keys returned in badge-counts
const VALID_TABS = ['trips', 'shift', 'inspection', 'expenses', 'damage', 'violations'];

// ─── GET /api/v1/drivers/badge-counts ─────────────
// Returns per-tab counts of NEW actionable items for the logged-in driver.
// "New" means created (or updated for expenses) AFTER the driver last viewed that tab.
// When the driver has never viewed a tab, ALL actionable items count.
router.get(
  '/badge-counts',
  authenticate,
  enforcePasswordChanged,
  async (req, res, next) => {
    try {
      const driverId = req.user.id;

      // Load all tab view timestamps in one query
      const tabViews = await prisma.driverTabView.findMany({
        where: { driverId },
        select: { tabName: true, viewedAt: true },
      });
      const viewedAt = Object.fromEntries(tabViews.map(v => [v.tabName, v.viewedAt]));

      // Helper: only apply the 'since' filter if the driver has ever viewed this tab
      const since = (tab, field = 'createdAt') => {
        const t = viewedAt[tab];
        return t ? { [field]: { gt: t } } : {};
      };

      const [trips, shift, inspection, expenses, damage, violations] = await Promise.all([
        // Trips: ASSIGNED and appeared after last trips-tab view
        prisma.trip.count({
          where: { driverId, status: 'ASSIGNED', ...since('trips') },
        }),
        // Shift: PendingVerification and appeared after last shift-tab view
        prisma.shift.count({
          where: { driverId, status: 'PendingVerification', ...since('shift') },
        }),
        // Inspection: pending and appeared after last inspection-tab view
        prisma.inspection.count({
          where: { driverId, status: 'pending', ...since('inspection') },
        }),
        // Expenses: rejected — use updatedAt (expense was created earlier, rejected later)
        prisma.expense.count({
          where: { driverId, status: 'rejected', ...since('expenses', 'updatedAt') },
        }),
        // Damage: reported and appeared after last damage-tab view
        prisma.damageReport.count({
          where: { driverId, status: 'reported', ...since('damage') },
        }),
        // Violations: seenAt IS NULL (still use per-record seenAt for accurate granularity)
        prisma.trafficViolation.count({
          where: { driverId, seenAt: null },
        }),
      ]);

      res.json({ trips, shift, inspection, expenses, damage, violations });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/v1/drivers/tabs/:tab/mark-viewed ───
// Called by any driver tab page on mount.
// Upserts driver_tab_views so badge counts will exclude items seen before now.
// For violations it also stamps seenAt=now() on all unseen records.
router.patch(
  '/tabs/:tab/mark-viewed',
  authenticate,
  enforcePasswordChanged,
  async (req, res, next) => {
    try {
      const { tab } = req.params;
      if (!VALID_TABS.includes(tab)) {
        return res.status(400).json({ error: { message: `Invalid tab name. Must be one of: ${VALID_TABS.join(', ')}` } });
      }

      const driverId = req.user.id;
      const now = new Date();

      // Upsert the view timestamp
      await prisma.driverTabView.upsert({
        where: { driverId_tabName: { driverId, tabName: tab } },
        create: { driverId, tabName: tab, viewedAt: now },
        update: { viewedAt: now },
      });

      // For violations: also stamp seenAt on individual records
      if (tab === 'violations') {
        await prisma.trafficViolation.updateMany({
          where: { driverId, seenAt: null },
          data:  { seenAt: now },
        });
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);


// ─── PUT /api/v1/drivers/profile ──────────────────
router.put(
  '/profile',
  authenticate,
  enforcePasswordChanged,
  upload.single('avatar'),
  [
    body('phone').optional().trim().escape(),
    body('language_preference').optional().isString().isIn(['en', 'ar']).withMessage('Invalid language preference'),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = { ...req.body };
      if (req.file) {
        data.profilePhotoUrl = await fileService.upload(req.file, 'profiles');
      }

      const driver = await driverService.updateDriver(req.user.id, data, req.user.id, req.clientIp);
      res.json(driver);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/drivers ─────────────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 }
  ]),
  [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('email').isEmail().matches(EMAIL_REGEX).withMessage('Valid email is required').normalizeEmail(),
    body('phone').notEmpty().withMessage('Phone number is required').matches(EGYPT_PHONE_REGEX).withMessage('Invalid Egyptian mobile phone format').trim().escape(),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('temporaryPassword').optional().isLength({ min: 8 }).withMessage('Temporary password must be at least 8 characters long'),
    body('licenseNumber').notEmpty().withMessage('License number is required').matches(/^[A-Z0-9-]+$/i).withMessage('Invalid license number format').trim().escape(),
    body().custom((value, { req }) => {
      if (!req.body.password && !req.body.temporaryPassword) {
        throw new Error('Either password or temporaryPassword is required');
      }
      if (!req.files?.avatar?.[0] || !req.files?.idCardFront?.[0] || !req.files?.idCardBack?.[0]) {
        throw new Error('Personal photo and national ID front/back are required');
      }
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = { ...req.body };

      const files = req.files || {};
      if (files.avatar?.[0]) data.avatarUrl = await fileService.upload(files.avatar[0], 'profiles');
      if (files.idCardFront?.[0]) data.idCardFront = await fileService.upload(files.idCardFront[0], 'identity');
      if (files.idCardBack?.[0]) data.idCardBack = await fileService.upload(files.idCardBack[0], 'identity');

      const driver = await driverService.createDriver(data, req.user.id, req.clientIp);
      res.status(201).json(driver);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/drivers ──────────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim().escape(),
    query('status').optional().isIn(['active', 'inactive', 'all']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('sortBy').optional().isIn(['createdAt', 'name', 'email']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await driverService.getDrivers(req.query);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/drivers/:id ──────────────────────
router.get(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const driver = await driverService.getDriverById(req.params.id);
      res.json(driver);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/drivers/:id ──────────────────────
router.put(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 }
  ]),
  [
    param('id').isUUID(),
    body('name').optional().trim().escape(),
    body('phone').optional().matches(EGYPT_PHONE_REGEX).withMessage('Invalid Egyptian mobile phone format').trim().escape(),
    body('licenseNumber').optional().matches(/^[A-Z0-9-]+$/i).withMessage('Invalid license number format').trim().escape(),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('language_preference').optional().isString().isIn(['en', 'ar']).withMessage('Invalid language preference'),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = { ...req.body };

      const files = req.files || {};
      if (files.avatar?.[0]) data.avatarUrl = await fileService.upload(files.avatar[0], 'profiles');
      if (files.idCardFront?.[0]) data.idCardFront = await fileService.upload(files.idCardFront[0], 'identity');
      if (files.idCardBack?.[0]) data.idCardBack = await fileService.upload(files.idCardBack[0], 'identity');

      const driver = await driverService.updateDriver(req.params.id, data, req.user.id, req.clientIp);
      res.json(driver);
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/v1/drivers/:id ───────────────────
router.delete(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await driverService.deactivateDriver(req.params.id, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/drivers/:id/reactivate ──────────
router.patch(
  '/:id/reactivate',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await driverService.reactivateDriver(req.params.id, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/v1/drivers/:id/permanent ─────────
router.delete(
  '/:id/permanent',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await driverService.deleteDriverPermanently(req.params.id, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/drivers/export (CSV) ──────────────
router.get(
  '/export',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const query = {
        ...req.query,
        page: 1,
        limit: Math.min(Math.max(parseInt(req.query.limit) || 5000, 1), 10000),
      };
      const result = await driverService.getDrivers(query);
      sendCsv(res, {
        filename: `drivers-${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { header: 'id', value: (d) => d.id },
          { header: 'name', value: (d) => d.name },
          { header: 'email', value: (d) => d.email },
          { header: 'phone', value: (d) => d.phone },
          { header: 'license_number', value: (d) => d.licenseNumber || '' },
          { header: 'active', value: (d) => (d.isActive ? 'true' : 'false') },
          { header: 'identity_verified', value: (d) => (d.identityVerified ? 'true' : 'false') },
          { header: 'created_at', value: (d) => d.createdAt?.toISOString?.() ?? d.createdAt },
        ],
        rows: result.drivers || [],
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
