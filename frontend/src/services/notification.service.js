import { httpService } from './http.service';

class NotificationService {
  /**
   * Fetch paginated notifications for the current user
   */
  async getNotifications({ limit = 30, offset = 0 } = {}) {
    return httpService.get(`/notifications?limit=${limit}&offset=${offset}`);
  }

  /**
   * Get the count of unseen (unread) notifications
   */
  async getUnseenCount() {
    return httpService.get('/notifications/unseen-count');
  }

  /**
   * Mark ALL notifications as read for the current user
   */
  async markAllAsRead() {
    return httpService.patch('/notifications/mark-all-read', {});
  }

  /**
   * Mark specific notification IDs as read
   */
  async markAsRead(ids) {
    return httpService.patch('/notifications/mark-read', { ids });
  }
}

export const notificationService = new NotificationService();
