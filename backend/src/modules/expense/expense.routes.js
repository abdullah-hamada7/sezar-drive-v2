const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const expenseService = require('./expense.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const { ValidationError } = require('../../errors');
const { sendCsv } = require('../../utils/csv');

const router = express.Router();
const receiptUpload = createUploader();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── POST /api/v1/expenses ────────────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('driver'),
  receiptUpload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'receiptPhoto', maxCount: 1 }]),
  [
    body('shiftId').isUUID().withMessage('Valid shift ID is required'),
    body('tripId').optional().isUUID().withMessage('tripId must be a valid UUID'),
    body('categoryId').optional().isUUID(),
    body('category').optional().isUUID(),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').optional().trim().escape(),
    body().custom(body => {
      if (!body.categoryId && !body.category) throw new Error('Category is required');
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const file = req.files?.['receipt']?.[0] || req.files?.['receiptPhoto']?.[0];
      
      let receiptUrl = null;
      if (file) {
        receiptUrl = await fileService.upload(file, 'receipts');
      }

      const expense = await expenseService.createExpense(
        { ...req.body, receiptUrl }, req.user.id, req.clientIp
      );
      res.status(201).json(expense);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/expenses ─────────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('driverId').optional().isUUID(),
    query('shiftId').optional().isUUID(),
    query('tripId').optional().isUUID(),
    query('categoryId').optional().isUUID(),
    query('tripSearch').optional().isString().trim().isLength({ min: 1, max: 200 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('minAmount').optional().isFloat({ min: 0 }).toFloat(),
    query('maxAmount').optional().isFloat({ min: 0 }).toFloat(),
    query('hasReceipt').optional().isBoolean().toBoolean(),
    query('sortBy').optional().isIn(['createdAt', 'amount', 'status']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('expenseId').optional().isUUID(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const filters = req.user.role === 'driver' ? { ...req.query, driverId: req.user.id } : req.query;
      const result = await expenseService.getExpenses(filters);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/expenses/export (CSV) ─────────────
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
      const result = await expenseService.getExpenses(query);

      sendCsv(res, {
        filename: `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { header: 'id', value: (e) => e.id },
          { header: 'created_at', value: (e) => e.createdAt?.toISOString?.() ?? e.createdAt },
          { header: 'status', value: (e) => e.status },
          { header: 'amount', value: (e) => e.amount },
          { header: 'currency', value: () => 'EGP' },
          { header: 'driver', value: (e) => e.driver?.name || '' },
          { header: 'category', value: (e) => e.category?.name || '' },
          { header: 'trip_id', value: (e) => e.trip?.id || '' },
          { header: 'pickup', value: (e) => e.trip?.pickupLocation || '' },
          { header: 'dropoff', value: (e) => e.trip?.dropoffLocation || '' },
          { header: 'description', value: (e) => e.description || '' },
          { header: 'receipt', value: (e) => (e.receiptUrl ? 'yes' : 'no') },
          { header: 'reviewer', value: (e) => e.reviewer?.name || '' },
          { header: 'reviewed_at', value: (e) => (e.reviewedAt?.toISOString?.() ?? e.reviewedAt) || '' },
          { header: 'rejection_reason', value: (e) => e.rejectionReason || '' },
        ],
        rows: result.expenses || [],
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /api/v1/expenses/review-bulk ──────────────
router.put(
  '/review-bulk',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    body('expenseIds').isArray({ min: 1, max: 200 }),
    body('expenseIds.*').isUUID(),
    body('action').isIn(['approve', 'reject', 'approved', 'rejected']),
    body('rejectionReason').optional({ nullable: true }).isString().trim().isLength({ max: 500 }).escape(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await expenseService.reviewExpensesBulk(req.body, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /api/v1/expenses/:id ─────────────────────
router.put(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const expense = await expenseService.updateExpense(req.params.id, req.body, req.user.id, req.clientIp);
      res.json(expense);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/expenses/:id/review ──────────────
router.put(
  '/:id/review',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('action').isIn(['approve', 'reject', 'approved', 'rejected']),
    body('rejectionReason').optional({ nullable: true }).isString().escape(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const expense = await expenseService.reviewExpense(
        req.params.id, req.user.id, req.body.action, req.body.rejectionReason, req.clientIp
      );
      res.json(expense);
    } catch (err) { next(err); }
  }
);

// ─── Expense Categories ───────────────────────────

router.get('/categories', authenticate, enforcePasswordChanged, async (req, res, next) => {
  try {
    const categories = await expenseService.getCategories();
    res.json(categories);
  } catch (err) { next(err); }
});

router.post(
  '/categories',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [body('name').notEmpty().trim().escape(), body('requiresApproval').optional().isBoolean()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const category = await expenseService.createCategory(req.body, req.user.id, req.clientIp);
      res.status(201).json(category);
    } catch (err) { next(err); }
  }
);

router.put(
  '/categories/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('name').optional().notEmpty().trim().escape(),
    body('requiresApproval').optional().isBoolean()
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const category = await expenseService.updateCategory(req.params.id, req.body, req.user.id, req.clientIp);
      res.json(category);
    } catch (err) { next(err); }
  }
);

module.exports = router;
