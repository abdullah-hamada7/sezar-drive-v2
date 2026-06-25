const driverAlert = require('../../services/driverAlert.service');

/**
 * ViolationNotifier — alerts drivers when a traffic violation is recorded.
 */
class ViolationNotifier {
  static onViolationCreated(driverId, violation) {
    const fineAmount = violation.fineAmount != null ? Number(violation.fineAmount) : 0;
    const location = violation.location || 'See details in the app';

    driverAlert.alertDriver(driverId, {
      type: 'violation_created',
      title: 'Traffic Violation Recorded',
      body: `Violation #${violation.violationNumber} — fine ${fineAmount.toFixed(2)} at ${location}`,
      entityId: violation.id,
      wsPayload: {
        violationId: violation.id,
        violationNumber: violation.violationNumber,
        fineAmount,
        location: violation.location,
        vehiclePlate: violation.vehicle?.plateNumber ?? null,
      },
    });
  }
}

module.exports = ViolationNotifier;
