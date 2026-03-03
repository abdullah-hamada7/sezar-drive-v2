const express = require('express');
const prisma = require('../../config/database');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');

const router = express.Router();

// ─── GET /api/v1/audit-logs ───────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 50, actorId, entityType, entityId, actionType, startDate, endDate, actorSearch } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {
        ...(actorId && { actorId }),
        ...(actorSearch && {
          actor: {
            OR: [
              { name: { contains: actorSearch, mode: 'insensitive' } },
              { email: { contains: actorSearch, mode: 'insensitive' } },
            ],
          },
        }),
        ...(entityType && { entityType }),
        ...(entityId && { entityId }),
        ...(actionType && { actionType: { contains: actionType } }),
        ...(startDate && endDate && {
          createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
        }),
      };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { actor: { select: { id: true, name: true, email: true, role: true } } },
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({
        logs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
