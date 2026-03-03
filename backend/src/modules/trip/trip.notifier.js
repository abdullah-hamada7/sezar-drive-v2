const { notifyAdmins, notifyDriver } = require('../tracking/tracking.ws');

/**
 * TripNotifier
 * Encapsulates real-time notifications for trip events.
 */
class TripNotifier {
  static onTripAssigned(driverId, trip, actorId = null) {
    notifyDriver(driverId, { 
      type: 'trip_assigned', 
      trip: {
        id: trip.id,
        pickupLocation: trip.pickupLocation,
        dropoffLocation: trip.dropoffLocation,
        price: trip.price
      }
    });
    notifyAdmins('trip_assigned', 'Trip Assigned', 'A trip has been assigned', {
      tripId: trip.id,
      driverId,
      actorId
    });
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
