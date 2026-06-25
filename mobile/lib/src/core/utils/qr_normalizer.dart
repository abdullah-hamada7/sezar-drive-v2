import 'dart:convert';

/// Normalizes scanned QR values (JSON payloads, URLs with query params).
String normalizeScannedQrValue(String raw) {
  var candidate = raw.trim();
  if (candidate.isEmpty) return candidate;

  if ((candidate.startsWith('{') && candidate.endsWith('}')) ||
      (candidate.startsWith('[') && candidate.endsWith(']'))) {
    try {
      final parsed = jsonDecode(candidate);
      if (parsed is Map<String, dynamic>) {
        final extracted = parsed['qrCode'] ?? parsed['qrIdentifier'] ?? parsed['code'] ?? parsed['id'];
        if (extracted is String && extracted.trim().isNotEmpty) {
          candidate = extracted.trim();
        }
      }
    } catch (_) {}
  }

  if (candidate.contains('://')) {
    try {
      final uri = Uri.parse(candidate);
      final queryCode = uri.queryParameters['qrCode'] ??
          uri.queryParameters['qr'] ??
          uri.queryParameters['code'] ??
          uri.queryParameters['id'];
      if (queryCode != null && queryCode.trim().isNotEmpty) {
        candidate = queryCode.trim();
      }
    } catch (_) {}
  }

  return candidate.trim();
}
