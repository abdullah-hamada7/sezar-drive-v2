/// Canonical driver alert event types and user-facing messages.
///
/// Keep in sync with backend `driverAlert.service.js` event types.
class DriverAlertEvents {
  DriverAlertEvents._();

  static const Set<String> alertTypes = {
    'trip_assigned',
    'trip_accepted',
    'trip_completed',
    'trip_cancelled',
    'shift_started',
    'shift_activated',
    'shift_closed',
    'damage_update',
    'damage_reviewed',
    'expense_reviewed',
    'identity_update',
    'violation_created',
  };

  static const Map<String, String> messages = {
    'trip_assigned': 'A new trip was assigned to you',
    'trip_accepted': 'Trip accepted successfully',
    'trip_completed': 'Trip completed successfully',
    'trip_cancelled': 'A trip was cancelled',
    'shift_started': 'Your shift request was created',
    'shift_activated': 'Your shift was activated — you can accept trips',
    'shift_closed': 'Your shift was closed',
    'damage_update': 'Your damage report was reviewed',
    'damage_reviewed': 'Your damage report was reviewed',
    'expense_reviewed': 'Your expense was reviewed',
    'identity_update': 'Your identity verification status was updated',
    'violation_created': 'A new traffic violation was recorded for you',
  };

  static const Map<String, String> titles = {
    'trip_assigned': 'New Trip Assigned',
    'trip_cancelled': 'Trip Cancelled',
    'shift_activated': 'Shift Activated',
    'shift_closed': 'Shift Closed',
    'violation_created': 'Traffic Violation',
    'expense_reviewed': 'Expense Review',
    'damage_update': 'Damage Report',
    'damage_reviewed': 'Damage Report',
    'identity_update': 'Identity Verification',
  };

  static String? messageFor(String eventType) => messages[eventType];

  static String titleFor(String eventType) =>
      titles[eventType] ?? 'Sezar Driver';
}
