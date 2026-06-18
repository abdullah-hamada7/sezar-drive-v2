const prisma = require('../config/database');

class NotificationService {
  /**
   * Create a notification for a user
   */
  async createNotification(userId, { title, body, type, entityId = null }) {
    return prisma.notification.create({
      data: { userId, title, body, type, entityId },
    });
  }

  /**
   * Get paginated notifications for a user (newest first)
   */
  async getNotifications(userId, { limit = 30, offset = 0 } = {}) {
    const [notifications, total, unseenCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unseenCount };
  }

  /**
   * Get the count of unseen (unread) notifications for a user
   */
  async getUnseenCount(userId) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  /**
   * Mark all unread notifications for a user as read
   * Returns the number of notifications that were marked
   */
  async markAllAsRead(userId) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }

  /**
   * Mark specific notifications by IDs as read (for a given user)
   */
  async markAsRead(userId, notificationIds) {
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId, // ensure user can only mark their own notifications
      },
      data: { isRead: true },
    });
    return result.count;
  }
}

module.exports = new NotificationService();
