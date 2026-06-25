const { notifyAdmins } = require('../tracking/tracking.ws');
const driverAlert = require('../../services/driverAlert.service');

/**
 * ShiftNotifier — alerts drivers on shift lifecycle changes.
 */
class ShiftNotifier {
  static onShiftStarted(driverName, shiftId, driverId) {
    notifyAdmins(
      'shift_started',
      'New Shift Started',
      `Driver ${driverName} has started a new shift and is pending verification.`,
      { shiftId },
    );
    if (driverId) {
      driverAlert.notifyDriverWs(driverId, { type: 'shift_started', shiftId });
    }
  }

  static onShiftActivated(shiftId, driverId, vehicleId) {
    notifyAdmins(
      'shift_activated',
      'Shift Activated',
      'Driver shift has been activated and is now live.',
      { shiftId, driverId, vehicleId },
    );
    driverAlert.alertDriver(driverId, {
      type: 'shift_activated',
      title: 'Shift Activated',
      body: 'Your shift is now active. You can accept trips.',
      entityId: shiftId,
      wsPayload: { shiftId, vehicleId },
    });
  }

  static onShiftAdminClosed(driverId, reason) {
    driverAlert.alertDriver(driverId, {
      type: 'shift_closed',
      title: 'Shift Closed by Admin',
      body: reason || 'Your shift was closed by an administrator.',
      wsPayload: { reason, closedBy: 'admin' },
    });
  }

  static onShiftClosed(shiftId, driverId, closedBy, reason, actorId = null) {
    notifyAdmins(
      'shift_closed',
      'Shift Closed',
      `Shift ${shiftId} was closed by ${closedBy}.`,
      { shiftId, driverId, closedBy, reason, actorId },
    );

    const isAdmin = closedBy === 'admin';
    driverAlert.alertDriver(driverId, {
      type: 'shift_closed',
      title: isAdmin ? 'Shift Closed by Admin' : 'Shift Closed',
      body: reason || (isAdmin
        ? 'Your shift was closed by an administrator.'
        : 'Your shift has been closed.'),
      entityId: shiftId,
      wsPayload: { shiftId, reason, closedBy },
      push: true,
      persist: true,
    });
  }
}

module.exports = ShiftNotifier;
