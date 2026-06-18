const { notifyAdmins, notifyDriver } = require('../tracking/tracking.ws');
const pushService = require('../../services/push.service');
const notificationService = require('../../services/notification.service');

/**
 * TripNotifier
 * Encapsulates real-time notifications for trip events.
 * Each method fires WebSocket events AND persists a Notification record
 * so the frontend can display a badge count and list of past alerts.
 */
class TripNotifier {
  static onTripAssigned(driverId, trip, actorId = null) {
    notifyDriver(driverId, { 
      type: 'trip_assigned', 
      trip: {
        id: trip.id,
        pickupLocation: trip.pickupLocation,
        dropoffLocation: trip.dropoffLocation,
        price: trip.price,
        paymentMethod: trip.paymentMethod
      }
    });
    notifyAdmins('trip_assigned', 'Trip Assigned', 'A trip has been assigned', {
      tripId: trip.id,
      driverId,
      actorId
    });

    const title = 'New Trip Assigned';
    const body = `Pick up at ${trip.pickupLocation || 'pickup location'}`;

    // Persist notification record (badge counting + history)
    notificationService.createNotification(driverId, {
      title,
      body,
      type: 'trip_assigned',
      entityId: trip.id,
    }).catch(err => console.error('[NotificationService] Failed to persist trip_assigned notification:', err));

    // Send background PWA push notification to the driver
    pushService.sendNotificationToUser(driverId, {
      title,
      body,
      tag: `trip_assigned_${trip.id}`,
      data: { tripId: trip.id }
    }).catch(err => console.error('Error sending push notification for trip assignment:', err));
  }

  static onTripStarted(driverName, details) {
    notifyAdmins('trip_started', 'Trip Started', `Driver ${driverName} started a trip`, details);
  }

  static onTripAccepted(driverId, tripId) {
    notifyAdmins('trip_accepted', 'Trip Accepted', 'Driver accepted assigned trip', { tripId, driverId });
    notifyDriver(driverId, { type: 'trip_accepted', tripId });
  }

  static onTripCompleted(driverId, tripId) {
    notifyAdmins('trip_completed', 'Trip Completed', 'A trip has been completed', { tripId, driverId });
    notifyDriver(driverId, { type: 'trip_completed', tripId });

    // Persist completion notification
    notificationService.createNotification(driverId, {
      title: 'Trip Completed',
      body: 'Your trip has been marked as completed.',
      type: 'trip_completed',
      entityId: tripId,
    }).catch(err => console.error('[NotificationService] Failed to persist trip_completed notification:', err));
  }

  static onTripCancelled(trip, userId, isAdmin, reason) {
    const notification = {
      type: 'trip_cancelled',
      tripId: trip.id,
      reason: reason || 'Cancelled',
      cancelledBy: userId
    };

    if (isAdmin) {
      notifyDriver(trip.driverId, notification);

      const title = 'Trip Cancelled';
      const body = `Trip was cancelled by admin. Reason: ${reason || 'Cancelled'}`;

      // Persist notification record for the driver
      notificationService.createNotification(trip.driverId, {
        title,
        body,
        type: 'trip_cancelled',
        entityId: trip.id,
      }).catch(err => console.error('[NotificationService] Failed to persist trip_cancelled notification:', err));

      // Send background PWA push notification to the driver
      pushService.sendNotificationToUser(trip.driverId, {
        title,
        body,
        tag: `trip_cancelled_${trip.id}`,
        data: { tripId: trip.id }
      }).catch(err => console.error('Error sending push notification for trip cancellation:', err));
    }

    notifyAdmins('trip_cancelled', 'Trip Cancelled', isAdmin ? 'Admin cancelled a trip' : 'Driver cancelled a trip', {
      tripId: trip.id,
      driverId: trip.driverId,
      reason,
      cancelledBy: userId,
      isAdmin,
      actorId: userId
    });
  }
}

module.exports = TripNotifier;
