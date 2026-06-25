import '../l10n/app_locale.dart';

/// Maps backend error codes to user-friendly messages (EN/AR).
String mapErrorCode(String? code, {String? fallback, String locale = 'en'}) {
  if (code == null || code.isEmpty) return fallback ?? 'Something went wrong.';

  const en = {
    'ACTIVE_SHIFT_EXISTS': 'You already have an active shift.',
    'ACTIVE_TRIP_EXISTS': 'You have a trip in progress. Complete it first.',
    'VEHICLE_NOT_FOUND': 'Vehicle not found. Check the QR code.',
    'VEHICLE_UNAVAILABLE': 'This vehicle is not available.',
    'VEHICLE_ALREADY_ASSIGNED': 'This vehicle is already assigned.',
    'DRIVER_ALREADY_HAS_VEHICLE': 'You already have a vehicle assigned.',
    'NO_ACTIVE_SHIFT': 'No active shift found.',
    'INSPECTION_REQUIRED': 'Vehicle inspection is required.',
    'INSPECTION_PHOTOS_REQUIRED': 'All inspection photos are required.',
    'NETWORK_ERROR': 'Network error. Check your connection.',
    'UNAUTHORIZED': 'Session expired. Please log in again.',
    'SESSION_EXPIRED': 'Session expired. Please log in again.',
    'BLOCKED_OFFLINE': 'This action requires an internet connection.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'ADMIN_OVERRIDE_REQUIRED': 'This action requires admin approval.',
    'FORBIDDEN': 'You are not allowed to perform this action.',
  };

  const ar = {
    'ACTIVE_SHIFT_EXISTS': 'لديك وردية نشطة بالفعل.',
    'ACTIVE_TRIP_EXISTS': 'لديك رحلة قيد التنفيذ. أكملها أولاً.',
    'VEHICLE_NOT_FOUND': 'المركبة غير موجودة. تحقق من رمز QR.',
    'NO_ACTIVE_SHIFT': 'لا توجد وردية نشطة.',
    'INSPECTION_REQUIRED': 'فحص المركبة مطلوب.',
    'NETWORK_ERROR': 'خطأ في الشبكة. تحقق من الاتصال.',
    'UNAUTHORIZED': 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.',
    'FORBIDDEN': 'غير مسموح لك بتنفيذ هذا الإجراء.',
  };

  final table = locale == 'ar' ? ar : en;
  return table[code] ?? fallback ?? code;
}

String extractErrorMessage(dynamic error, {String? locale, String? fallback}) {
  final lang = locale ?? AppLocale.languageCode;
  try {
    final response = (error as dynamic).response;
    if (response != null) {
      final data = response.data;
      if (data is Map) {
        final err = data['error'];
        if (err is Map) {
          final code = err['code'] as String? ?? data['code'] as String?;
          final msg = err['message'] as String?;
          return mapErrorCode(code, fallback: msg ?? fallback, locale: lang);
        }
        if (data['message'] != null) {
          return mapErrorCode(data['code'] as String?, fallback: data['message'].toString(), locale: lang);
        }
      }
      return fallback ?? 'Server error (${response.statusCode})';
    }
  } catch (_) {}
  return fallback ?? error.toString();
}
