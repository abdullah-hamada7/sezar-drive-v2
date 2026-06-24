import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';

class CachedEntry {
  final String endpoint;
  final dynamic data;
  final DateTime cachedAt;

  CachedEntry({
    required this.endpoint,
    required this.data,
    required this.cachedAt,
  });

  bool get isExpired {
    const cacheTtl = Duration(hours: 2);
    return DateTime.now().difference(cachedAt) > cacheTtl;
  }

  Map<String, dynamic> toJson() => {
    'endpoint': endpoint,
    'data': data,
    'cachedAt': cachedAt.toIso8601String(),
  };

  factory CachedEntry.fromJson(Map<String, dynamic> json) => CachedEntry(
    endpoint: json['endpoint'] as String,
    data: json['data'],
    cachedAt: DateTime.parse(json['cachedAt'] as String),
  );
}

class ReadCacheService {
  static const String _boxName = 'read_cache_box';

  static Future<void> init() async {
    await Hive.openBox<String>(_boxName);
  }

  Box<String> get _box => Hive.box<String>(_boxName);

  Future<void> set(String endpoint, dynamic data) async {
    final entry = CachedEntry(
      endpoint: endpoint,
      data: data,
      cachedAt: DateTime.now(),
    );
    await _box.put(endpoint, jsonEncode(entry.toJson()));
  }

  Future<dynamic> get(String endpoint) async {
    final raw = _box.get(endpoint);
    if (raw == null) return null;

    try {
      final entry = CachedEntry.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      if (entry.isExpired) {
        await _box.delete(endpoint);
        return null;
      }
      return entry.data;
    } catch (_) {
      await _box.delete(endpoint);
      return null;
    }
  }

  Future<void> clear() async {
    await _box.clear();
  }

  Future<void> remove(String endpoint) async {
    await _box.delete(endpoint);
  }

  /// Returns true if the endpoint is cacheable (GET reads for common resources).
  static bool isCacheable(String method, String endpoint) {
    if (method != 'GET') return false;
    const cacheablePatterns = [
      '/trips',
      '/shifts',
      '/expenses',
      '/inspections',
      '/violations/my',
      '/notifications',
      '/stats/my-daily-report',
      '/stats/my-daily-revenue',
      '/stats/my-activity',
      '/expenses/categories',
      '/drivers/badge-counts',
    ];
    for (final pattern in cacheablePatterns) {
      if (endpoint.startsWith(pattern)) return true;
    }
    return false;
  }
}
