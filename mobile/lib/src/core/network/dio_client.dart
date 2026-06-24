import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../config/app_config.dart';
import '../network/cache_interceptor.dart';
import '../storage/secure_storage.dart';
import '../services/session_revoked_notifier.dart';

class DioClient {
  final Dio _dio;
  final SecureStorage _storage;
  final SessionRevokedNotifier _sessionRevoked;
  late String _baseUrl;

  DioClient(this._storage, this._sessionRevoked) : _dio = Dio() {
    _baseUrl = AppConfig.apiBaseUrl;

    _dio.options
      ..baseUrl = _baseUrl
      ..connectTimeout = const Duration(milliseconds: AppConfig.connectTimeoutMs)
      ..receiveTimeout = const Duration(milliseconds: AppConfig.receiveTimeoutMs)
      ..headers = {'Accept': 'application/json'};

    // Log requests in non-production builds only
    if (!AppConfig.isProduction) {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => debugPrint('[DioClient] $obj'),
      ));
    }

    _dio.interceptors.add(CacheInterceptor());

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Attach JWT access token
          final token = await _storage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          // Attach a stable device fingerprint for device-binding logic
          var fingerprint = await _storage.getDeviceFingerprint();
          if (fingerprint == null) {
            fingerprint = const Uuid().v4();
            await _storage.saveDeviceFingerprint(fingerprint);
          }
          options.headers['X-Device-Fingerprint'] = fingerprint;

          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Silent token-refresh on 401 — mirrors web frontend tryRefresh()
          if (error.response?.statusCode == 401) {
            final authHeader = error.requestOptions.headers['Authorization'];
            if (authHeader != null && authHeader.toString().isNotEmpty) {
              final refreshToken = await _storage.getRefreshToken();
              if (refreshToken != null) {
                try {
                  final refreshResponse = await Dio().post(
                    '$_baseUrl/auth/refresh',
                    data: {'refreshToken': refreshToken},
                  );
                  final dynamic data = refreshResponse.data;
                  final String? newAccessToken;
                  if (data is Map) {
                    newAccessToken = data['accessToken'] as String?;
                  } else if (data is String) {
                    newAccessToken = jsonDecode(data)['accessToken'] as String?;
                  } else {
                    newAccessToken = null;
                  }
                  if (newAccessToken != null) {
                    await _storage.saveToken(newAccessToken);
                    // Retry original request with fresh token
                    final retryOptions = error.requestOptions;
                    retryOptions.headers['Authorization'] =
                        'Bearer $newAccessToken';
                    final cloneReq = await _dio.fetch(retryOptions);
                    return handler.resolve(cloneReq);
                  }
                } catch (_) {
                  await _storage.clearSession();
                  _sessionRevoked.revoke();
                }
              } else {
                await _storage.clearSession();
                _sessionRevoked.revoke();
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  /// Allows runtime base-URL override (e.g. from a deep-link or test harness).
  void setBaseUrl(String url) {
    _baseUrl = url;
    _dio.options.baseUrl = url;
  }

  Dio get dio => _dio;
  String get baseUrl => _baseUrl;
}
