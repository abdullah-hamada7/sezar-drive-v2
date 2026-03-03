const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const adminService = require('./admin.service');
const { authenticate, enforcePasswordChanged, authorizeSuperAdmin } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');

const router = express.Router();

function handleValidation(req) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── POST /api/v1/admins ─────────────────────────
router.post(
    '/',
    authenticate, enforcePasswordChanged, authorizeSuperAdmin,
    [
        body('name').notEmpty().withMessage('Name is required').trim().escape(),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('temporaryPassword').isLength({ min: 8 }).withMessage('Temporary password must be at least 8 characters long'),
        body('adminRole').isIn(['SUPER_ADMIN', 'SYSTEM_ADMIN']).withMessage('Role must be SUPER_ADMIN or SYSTEM_ADMIN'),
    ],
    async (req, res, next) => {
        try {
            handleValidation(req);
            const data = { ...req.body };
            const admin = await adminService.createAdmin(data, req.user.id, req.clientIp);
            res.status(201).json(admin);
        } catch (err) { next(err); }
    }
);

// ─── GET /api/v1/admins ──────────────────────────
router.get(
    '/',
    authenticate, enforcePasswordChanged, authorizeSuperAdmin,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('search').optional().trim(),
    ],
    async (req, res, next) => {
        try {
            handleValidation(req);
            const result = await adminService.getAdmins(req.query);
            res.json(result);
        } catch (err) { next(err); }
    }
);

// ─── DELETE /api/v1/admins/:id ───────────────────
router.delete(
    '/:id',
    authenticate, enforcePasswordChanged, authorizeSuperAdmin,
    [param('id').isUUID()],
    async (req, res, next) => {
        try {
            handleValidation(req);
            const result = await adminService.deactivateAdmin(req.params.id, req.user.id, req.clientIp);
            res.json(result);
        } catch (err) { next(err); }
    }
);

// ─── PATCH /api/v1/admins/:id/reactivate ──────────
router.patch(
    '/:id/reactivate',
    authenticate, enforcePasswordChanged, authorizeSuperAdmin,
    [param('id').isUUID()],
    async (req, res, next) => {
        try {
            handleValidation(req);
            const result = await adminService.reactivateAdmin(req.params.id, req.user.id, req.clientIp);
            res.json(result);
        } catch (err) { next(err); }
    }
);

module.exports = router;
