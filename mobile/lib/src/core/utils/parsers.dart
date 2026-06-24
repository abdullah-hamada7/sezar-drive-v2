import 'dart:convert';

double? parseDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

double parseDoubleWithDefault(dynamic value, double defaultValue) {
  return parseDouble(value) ?? defaultValue;
}

int? parseInt(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

int parseIntWithDefault(dynamic value, int defaultValue) {
  return parseInt(value) ?? defaultValue;
}

bool parseBool(dynamic value, bool defaultValue) {
  if (value == null) return defaultValue;
  if (value is bool) return value;
  if (value is String) {
    return value.toLowerCase() == 'true' || value == '1';
  }
  if (value is num) {
    return value != 0;
  }
  return defaultValue;
}

Map<String, dynamic> parseResponseMap(dynamic responseData) {
  if (responseData == null) return {};
  if (responseData is Map) {
    return Map<String, dynamic>.from(responseData);
  }
  if (responseData is String) {
    try {
      final decoded = jsonDecode(responseData);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}
  }
  return {};
}

List<dynamic> parseResponseList(dynamic responseData) {
  if (responseData == null) return [];
  if (responseData is List) {
    return responseData;
  }
  if (responseData is String) {
    try {
      final decoded = jsonDecode(responseData);
      if (decoded is List) {
        return decoded;
      }
    } catch (_) {}
  }
  return [];
}
