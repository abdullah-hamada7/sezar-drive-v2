class ApiEndpoints {
  static const String login = '/auth/login';
  static const String verifyDevice = '/auth/verify-device';
  static const String changePassword = '/auth/change-password';
  static const String refreshToken = '/auth/refresh';        // ← was /auth/refresh-token
  static const String me = '/auth/me';
  static const String preferences = '/auth/preferences';
  static const String rescueRequest = '/auth/rescue/request';
  static const String rescueVerify = '/auth/rescue/verify';

  static const String shifts = '/shifts';
  static const String activeShift = '/shifts/active';
  static String activateShift(String id) => '/shifts/$id/activate';
  static String closeShift(String id) => '/shifts/$id/close';
  static const String verifyShiftSelfie = '/verify/shift-selfie';
  static const String verifyIdentity = '/verify/identity';

  // ← was /vehicles/assign-self (non-existent). Correct: /vehicles/scan-qr
  static const String scanQr = '/vehicles/scan-qr';

  static const String trips = '/trips';
  static String tripDetails(String id) => '/trips/$id';
  static String acceptTrip(String id) => '/trips/$id/accept';
  static String rejectTrip(String id) => '/trips/$id/reject';
  static String startTrip(String id) => '/trips/$id/start';
  static String completeTrip(String id) => '/trips/$id/complete';
  static String cancelTrip(String id) => '/trips/$id/cancel';
  static String cashCollected(String id) => '/trips/$id/cash-collected';

  static const String inspections = '/inspections';
  static String completeInspection(String id) => '/inspections/$id/complete';
  static String uploadInspectionPhoto(String id, String direction) => '/inspections/$id/photos/$direction';

  static const String expenses = '/expenses';
  static const String expenseCategories = '/expenses/categories';

  static const String damageReports = '/damage-reports';
  static String uploadDamagePhoto(String id) => '/damage-reports/$id/photos';

  static const String violations = '/violations';
  static const String myViolations = '/violations/my';     // ← driver-scoped list
  static String markViolationSeen(String id) => '/violations/$id/seen';

  static const String notifications = '/notifications';
  // ← was /notifications/read — correct PATCH endpoint is mark-all-read
  static const String markAllNotificationsRead = '/notifications/mark-all-read';
  static String markNotificationRead(String id) => '/notifications/$id/read';

  static const String badgeCounts = '/drivers/badge-counts';
  static String markTabViewed(String tab) => '/drivers/tabs/$tab/mark-viewed';

  // Driver-scoped stats (not admin /stats/daily-report which returns 403)
  static const String myDailyReport = '/stats/my-daily-report';
  static const String myDailyRevenue = '/stats/my-daily-revenue';
  static const String myActivity = '/stats/my-activity';
}
