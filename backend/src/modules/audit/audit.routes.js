const express = require('express');
const prisma = require('../../config/database');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { sendCsv } = require('../../utils/csv');

const router = express.Router();

function buildDateRange({ startDate, endDate }) {
  const range = {};
  if (startDate) {
    const d = new Date(startDate);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (endDate) {
    const d = new Date(endDate);
    if (!Number.isNaN(d.getTime())) range.lte = d;
  }
  return Object.keys(range).length ? range : null;
}

function buildWhere({ actorId, entityType, entityId, actionType, actorSearch, startDate, endDate }) {
  const createdAt = buildDateRange({ startDate, endDate });
  return {
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
    ...(createdAt && { createdAt }),
  };
}

// ─── GET /api/v1/audit-logs/export (CSV) ───────────
router.get(
  '/export',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const {
        limit = 5000,
        actorId,
        entityType,
        entityId,
        actionType,
        startDate,
        endDate,
        actorSearch,
      } = req.query;

      const take = Math.min(Math.max(parseInt(limit) || 5000, 1), 10000);
      const where = buildWhere({ actorId, entityType, entityId, actionType, actorSearch, startDate, endDate });

      const logs = await prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true, role: true } } },
        take,
        orderBy: { createdAt: 'desc' },
      });

      sendCsv(res, {
        filename: `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { header: 'timestamp', value: (l) => l.createdAt?.toISOString?.() ?? l.createdAt },
          { header: 'actor_name', value: (l) => l.actor?.name || '' },
          { header: 'actor_email', value: (l) => l.actor?.email || '' },
          { header: 'actor_role', value: (l) => l.actor?.role || 'system' },
          { header: 'action_type', value: (l) => l.actionType || '' },
          { header: 'entity_type', value: (l) => l.entityType || '' },
          { header: 'entity_id', value: (l) => l.entityId || '' },
          { header: 'ip_address', value: (l) => l.ipAddress || '' },
        ],
        rows: logs,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/v1/audit-logs ───────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 50, actorId, entityType, entityId, actionType, startDate, endDate, actorSearch } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = buildWhere({ actorId, entityType, entityId, actionType, actorSearch, startDate, endDate });

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
