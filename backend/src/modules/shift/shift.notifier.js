const { notifyAdmins, notifyDriver } = require('../tracking/tracking.ws');

/**
 * ShiftNotifier
 * Encapsulates real-time notifications for shift events.
 */
class ShiftNotifier {
  static onShiftStarted(driverName, shiftId, driverId) {
    notifyAdmins(
      'shift_started', 
      'New Shift Started', 
      `Driver ${driverName} has started a new shift and is pending verification.`, 
      { shiftId }
    );
    if (driverId) {
      notifyDriver(driverId, {
        type: 'shift_started',
        shiftId
      });
    }
  }

  static onShiftActivated(shiftId, driverId, vehicleId) {
    notifyAdmins(
      'shift_activated', 
      'Shift Activated', 
      'Driver shift has been activated and is now live.', 
      { shiftId, driverId, vehicleId }
    );
    notifyDriver(driverId, {
      type: 'shift_activated',
      shiftId,
      vehicleId
    });
  }

  static onShiftAdminClosed(driverId, reason) {
    notifyDriver(driverId, {
      type: 'shift_closed',
      reason,
      closedBy: 'admin'
    });
  }

  static onShiftClosed(shiftId, driverId, closedBy, reason, actorId = null) {
    notifyAdmins(
      'shift_closed',
      'Shift Closed',
      `Shift ${shiftId} was closed by ${closedBy}.`,
      { shiftId, driverId, closedBy, reason, actorId }
    );
    notifyDriver(driverId, {
      type: 'shift_closed',
      shiftId,
      reason,
      closedBy
    });
  }
}

module.exports = ShiftNotifier;
