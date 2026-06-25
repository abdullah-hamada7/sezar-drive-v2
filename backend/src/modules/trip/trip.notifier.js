const NotificationAdapter = require('../../services/notificationAdapter.service');

/**
 * TripNotifier — alerts drivers on trip lifecycle changes.
 */
class TripNotifier {
  static onTripAssigned(driverId, trip, actorId = null) {
    NotificationAdapter.notifyAdmins('trip_assigned', 'Trip Assigned', 'A trip has been assigned', {
      tripId: trip.id,
      driverId,
      actorId,
    });

    NotificationAdapter.alertDriver(driverId, {
      type: 'trip_assigned',
      title: 'New Trip Assigned',
      body: `Pick up at ${trip.pickupLocation || 'pickup location'}`,
      entityId: trip.id,
      wsPayload: {
        trip: {
          id: trip.id,
          pickupLocation: trip.pickupLocation,
          dropoffLocation: trip.dropoffLocation,
          price: trip.price,
          paymentMethod: trip.paymentMethod,
        },
      },
    });
  }

  static onTripStarted(driverName, details) {
    NotificationAdapter.notifyAdmins('trip_started', 'Trip Started', `Driver ${driverName} started a trip`, details);
  }

  static onTripAccepted(driverId, tripId) {
    NotificationAdapter.notifyAdmins('trip_accepted', 'Trip Accepted', 'Driver accepted assigned trip', { tripId, driverId });
    NotificationAdapter.notifyDriverWs(driverId, { type: 'trip_accepted', tripId });
  }

  static onTripCompleted(driverId, tripId) {
    NotificationAdapter.notifyAdmins('trip_completed', 'Trip Completed', 'A trip has been completed', { tripId, driverId });
    NotificationAdapter.alertDriver(driverId, {
      type: 'trip_completed',
      title: 'Trip Completed',
      body: 'Your trip has been marked as completed.',
      entityId: tripId,
      wsPayload: { tripId },
      push: false,
    });
  }

  static onTripCancelled(trip, userId, isAdmin, reason) {
    NotificationAdapter.notifyAdmins('trip_cancelled', 'Trip Cancelled', isAdmin ? 'Admin cancelled a trip' : 'Driver cancelled a trip', {
      tripId: trip.id,
      driverId: trip.driverId,
      reason,
      cancelledBy: userId,
      isAdmin,
      actorId: userId,
    });

    if (!isAdmin) return;

    NotificationAdapter.alertDriver(trip.driverId, {
      type: 'trip_cancelled',
      title: 'Trip Cancelled',
      body: `Trip was cancelled by admin. Reason: ${reason || 'Cancelled'}`,
      entityId: trip.id,
      wsPayload: {
        tripId: trip.id,
        reason: reason || 'Cancelled',
        cancelledBy: userId,
      },
    });
  }
}

module.exports = TripNotifier;
