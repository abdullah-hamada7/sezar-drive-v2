const prisma = require('../config/database');

/**
 * AuditService
 * Centralized logging for system actions.
 */
class AuditService {
  /**
   * Log a system action.
   * @param {Object} data
   * @param {string} data.actorId - ID of the user performing the action
   * @param {string} data.actionType - Type of action (e.g., 'shift.created', 'trip.started')
   * @param {string} data.entityType - Type of entity affected (e.g., 'shift', 'trip', 'user')
   * @param {string} data.entityId - ID of the entity affected
   * @param {Object} [data.previousState] - State before the action
   * @param {Object} [data.newState] - State after the action
   * @param {string} [data.ipAddress] - IP address of the requester
   * @param {Object} [data.metadata] - Additional context
   */
  static async log({
    actorId,
    actionType,
    entityType,
    entityId,
    previousState = null,
    newState = null,
    ipAddress = null,
    metadata = {}
  }, prismaClient = prisma) {
    try {
      return await prismaClient.auditLog.create({
        data: {
          actorId,
          actionType,
          entityType,
          entityId,
          previousState,
          newState,
          ipAddress,
          metadata,
        },
      });
    } catch (error) {
      // In production, consider logging errors to a monitoring service (e.g., Sentry)
      // but don't crash the main business logic if audit logging fails.
      console.error('Audit Logging Failed:', error);
      return null;
    }
  }

  /**
   * Log a transition with a specific reason or override.
   */
  static async logOverride(data, reason) {
    return this.log({
      ...data,
      metadata: { ...data.metadata, override: true, reason },
    });
  }
}

module.exports = AuditService;
