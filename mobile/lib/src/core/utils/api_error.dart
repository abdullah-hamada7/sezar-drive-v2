import '../l10n/app_locale.dart';
import 'error_messages.dart';

String apiError(dynamic error, {String? fallback}) {
  return extractErrorMessage(
    error,
    locale: AppLocale.languageCode,
    fallback: fallback,
  );
}
