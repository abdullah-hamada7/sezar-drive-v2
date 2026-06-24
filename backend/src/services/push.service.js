const webPush = require('web-push');
const config = require('../config');
const prisma = require('../config/database');
const fcmService = require('./fcm.service');

// Initialize Web Push with VAPID details
webPush.setVapidDetails(
  config.vapid.subject,
  config.vapid.publicKey,
  config.vapid.privateKey
);

class PushService {
  /**
   * Save or update a subscription for a user
   */
  async saveSubscription(userId, subscriptionData) {
    if (!subscriptionData || !subscriptionData.endpoint) {
      throw new Error('Subscription endpoint is required');
    }

    const { endpoint, keys } = subscriptionData;

    return await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        keys: keys || {},
      },
      create: {
        userId,
        endpoint,
        keys: keys || {},
      },
    });
  }

  /**
   * Remove a subscription by endpoint
   */
  async removeSubscription(endpoint) {
    try {
      await prisma.pushSubscription.delete({
        where: { endpoint },
      });
      return true;
    } catch (error) {
      // If subscription doesn't exist, just ignore
      return false;
    }
  }

  async _sendWebPush(userId, payload) {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return { success: 0, failure: 0, total: 0 };
    }

    const notificationPayload = JSON.stringify(payload);
    let successCount = 0;
    let failureCount = 0;

    const promises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys || {},
      };

      try {
        await webPush.sendNotification(pushSubscription, notificationPayload);
        successCount++;
      } catch (error) {
        failureCount++;
        console.error('Web Push Send Error:', error);
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`Removing expired subscription: ${sub.endpoint}`);
          await this.removeSubscription(sub.endpoint);
        }
      }
    });

    await Promise.all(promises);

    return {
      success: successCount,
      failure: failureCount,
      total: subscriptions.length,
    };
  }

  /**
   * Send push to user via web-push (PWA) and FCM (mobile).
   */
  async sendNotificationToUser(userId, payload) {
    const [web, fcm] = await Promise.all([
      this._sendWebPush(userId, payload),
      fcmService.sendToUser(userId, payload),
    ]);
    return { web, fcm };
  }
}

module.exports = new PushService();
