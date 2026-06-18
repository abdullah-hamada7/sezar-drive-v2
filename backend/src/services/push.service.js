const webPush = require('web-push');
const config = require('../config');
const prisma = require('../config/database');

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

  /**
   * Send a push notification to all active subscriptions of a user
   */
  async sendNotificationToUser(userId, payload) {
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
      // Re-create the push subscription object as expected by web-push
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
        // If the browser service reports 410 Gone or 404, the subscription is expired/revoked
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
}

module.exports = new PushService();
