const express = require('express');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const expenseService = require('./expense.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const { ValidationError } = require('../../errors');

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
  async (req, res, next) => {
    try {
      const filters = req.user.role === 'driver' ? { ...req.query, driverId: req.user.id } : req.query;
      const result = await expenseService.getExpenses(filters);
      res.json(result);
    } catch (err) { next(err); }
  }
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
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const category = await expenseService.updateCategory(req.params.id, req.body, req.user.id, req.clientIp);
      res.json(category);
    } catch (err) { next(err); }
  }
);

module.exports = router;
