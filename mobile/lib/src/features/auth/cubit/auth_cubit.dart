import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import '../../../core/domain/driver_models.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/multipart_form.dart';
import '../../../core/services/mobile_push_service.dart';
import '../../../core/services/session_revoked_notifier.dart';
import '../../../core/services/service_locator.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

sealed class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

class AuthAuthenticated extends AuthState {
  final User user;
  const AuthAuthenticated(this.user);

  @override
  List<Object?> get props =>
      [user.id, user.email, user.name, user.identityVerified];
}

class AuthUnauthenticated extends AuthState {}

class AuthMustChangePassword extends AuthState {
  final String tempToken;
  final String? bannerMessage;
  const AuthMustChangePassword(this.tempToken, {this.bannerMessage});

  @override
  List<Object?> get props => [tempToken, bannerMessage];
}

class AuthDeviceUnverified extends AuthState {
  final String userId;
  final String verificationToken;
  final String? bannerMessage;
  const AuthDeviceUnverified(this.userId, this.verificationToken,
      {this.bannerMessage});

  @override
  List<Object?> get props => [userId, verificationToken, bannerMessage];
}

class AuthVerifyingDevice extends AuthState {
  final String userId;
  final String verificationToken;
  const AuthVerifyingDevice(this.userId, this.verificationToken);

  @override
  List<Object?> get props => [userId, verificationToken];
}

class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

class AuthPasswordChanged extends AuthState {}

class AuthCubit extends Cubit<AuthState> {
  final DioClient _client;
  final SecureStorage _storage;
  String? _pendingLoginPassword;

  bool get hasPendingLoginPassword =>
      _pendingLoginPassword != null && _pendingLoginPassword!.isNotEmpty;

  AuthCubit(this._client, this._storage, SessionRevokedNotifier sessionRevoked)
      : super(AuthInitial()) {
    sessionRevoked.onSessionRevoked = () => handleSessionRevoked();
  }

  Future<void> handleSessionRevoked() async {
    if (isClosed || state is AuthUnauthenticated) return;
    if (state is AuthDeviceUnverified || state is AuthVerifyingDevice) {
      return;
    }
    _pendingLoginPassword = null;
    await _storage.clearSession();
    getIt<MobilePushService>().onSessionCleared();
    emit(AuthUnauthenticated());
  }

  Future<void> cancelDeviceVerification() async {
    _pendingLoginPassword = null;
    await _storage.clearAuthFlow();
    getIt<MobilePushService>().onSessionCleared();
    emit(AuthUnauthenticated());
  }

  Future<void> checkAuthStatus() async {
    final token = await _storage.getToken();
    if (token == null) {
      final restored = await _restorePendingDeviceVerification();
      if (restored) return;
      emit(AuthUnauthenticated());
      return;
    }

    try {
      final response = await _client.dio.get('/auth/me');
      final data = _parseResponseMap(response.data);
      final userJson = _normalizeUserJson(_parseUserMap(data['user']));
      final user = User.fromJson(userJson);
      await _storage.saveUserProfile(jsonEncode(userJson));
      await _storage.clearPendingDeviceVerification();
      if (user.mustChangePassword) {
        emit(AuthMustChangePassword(token));
      } else {
        emit(AuthAuthenticated(user));
        await getIt<MobilePushService>().registerAfterLogin();
      }
    } catch (e) {
      if (_isAuthFailure(e)) {
        await _storage.clearSession();
        final restored = await _restorePendingDeviceVerification();
        if (restored) return;
        emit(AuthUnauthenticated());
        return;
      }
      final cached = await _storage.getUserProfile();
      if (cached != null) {
        try {
          final user = User.fromJson(
            _normalizeUserJson(jsonDecode(cached) as Map<String, dynamic>),
          );
          emit(AuthAuthenticated(user));
          await getIt<MobilePushService>().registerAfterLogin();
          return;
        } catch (_) {}
      }
      emit(AuthUnauthenticated());
    }
  }

  Future<void> login(String email, String password) async {
    emit(AuthLoading());
    _pendingLoginPassword = password;
    final normalizedEmail = email.trim().toLowerCase();
    try {
      var fingerprint = await _storage.getDeviceFingerprint();
      if (fingerprint == null || fingerprint.trim().isEmpty) {
        fingerprint = const Uuid().v4();
        await _storage.saveDeviceFingerprint(fingerprint);
      }
      final response = await _client.dio.post('/auth/login', data: {
        'email': normalizedEmail,
        'password': password,
        'deviceFingerprint': fingerprint,
        'client': 'driver-app',
      });

      final data = _parseResponseMap(response.data);

      final requiresVerification =
          parseBool(data['requiresVerification'], false);
      if (requiresVerification) {
        final userId = data['userId']?.toString() ?? normalizedEmail;
        final verificationToken =
            (data['verificationToken'] ?? data['verification_token'])
                    ?.toString() ??
                '';
        await _storage.clearSession();
        await _persistPendingDeviceVerification(userId, verificationToken);
        getIt<MobilePushService>().onSessionCleared();
        emit(AuthDeviceUnverified(userId, verificationToken));
        return;
      }

      final accessToken = _readAccessToken(data);
      final userJson =
          _normalizeOptionalUserJson(_parseUserMapOptional(data['user']));

      if (accessToken != null && userJson != null) {
        final userRole = userJson['role']?.toString();
        if (userRole != 'driver') {
          _pendingLoginPassword = null;
          emit(const AuthError(
              'Access denied: Admins cannot sign in to the driver app.'));
          return;
        }

        await _storage.clearPendingDeviceVerification();
        await _completeLogin(
            accessToken, data['refreshToken'] as String?, userJson);
      } else {
        _pendingLoginPassword = null;
        emit(const AuthError('Login failed: unexpected server response.'));
      }
    } catch (e) {
      _pendingLoginPassword = null;
      emit(AuthError(_extractErrorMessage(e)));
    }
  }

  Future<void> verifyDevice(
      String userId, String verificationToken, XFile selfieFile) async {
    emit(AuthVerifyingDevice(userId, verificationToken));
    try {
      var fingerprint = await _storage.getDeviceFingerprint();
      if (fingerprint == null || fingerprint.trim().isEmpty) {
        fingerprint = const Uuid().v4();
        await _storage.saveDeviceFingerprint(fingerprint);
      }
      final bytes = await selfieFile.readAsBytes();
      final fields = <String, String>{
        'userId': userId,
        'deviceFingerprint': fingerprint,
        'client': 'driver-app',
      };
      if (verificationToken.isNotEmpty) {
        fields['verificationToken'] = verificationToken;
      }
      final formData = buildMultipartForm(
        fields: fields,
        files: {
          'photo': jpegMultipartFromBytes(
            bytes,
            filename:
                'device_selfie_${DateTime.now().millisecondsSinceEpoch}.jpg',
          ),
        },
      );
      final response =
          await _client.dio.post('/auth/verify-device', data: formData);

      final data = _parseResponseMap(response.data);
      final accessToken = _readAccessToken(data);
      final userJson =
          _normalizeOptionalUserJson(_parseUserMapOptional(data['user']));

      if (accessToken == null || userJson == null) {
        emit(AuthDeviceUnverified(
          userId,
          verificationToken,
          bannerMessage:
              'Device verification failed: unexpected server response.',
        ));
        return;
      }

      final userRole = userJson['role']?.toString();
      if (userRole != 'driver') {
        emit(AuthDeviceUnverified(
          userId,
          verificationToken,
          bannerMessage: 'Access denied: Admins cannot sign in to the driver app.',
        ));
        return;
      }

      await _storage.clearPendingDeviceVerification();
      await _completeLogin(
          accessToken, data['refreshToken'] as String?, userJson);
    } catch (e) {
      emit(AuthDeviceUnverified(
        userId,
        verificationToken,
        bannerMessage: 'Device verification failed: ${_extractErrorMessage(e)}',
      ));
    }
  }

  Future<void> _completeLogin(
    String accessToken,
    String? refreshToken,
    Map<String, dynamic> userJson,
  ) async {
    await _storage.saveToken(accessToken);
    if (refreshToken != null) {
      await _storage.saveRefreshToken(refreshToken);
    }
    final normalizedUserJson = _normalizeUserJson(userJson);
    final user = User.fromJson(normalizedUserJson);
    await _storage.saveUserProfile(jsonEncode(normalizedUserJson));
    if (user.mustChangePassword) {
      emit(AuthMustChangePassword(accessToken));
    } else {
      _pendingLoginPassword = null;
      await _storage.clearPendingDeviceVerification();
      emit(AuthAuthenticated(user));
      await getIt<MobilePushService>().registerAfterLogin();
    }
  }

  Future<void> changePassword(
    String newPassword, {
    String? currentPassword,
  }) async {
    final current = currentPassword ?? _pendingLoginPassword;
    if (current == null || current.isEmpty) {
      emit(const AuthMustChangePassword('',
          bannerMessage: 'Current password is required.'));
      return;
    }

    emit(AuthLoading());
    try {
      final response = await _client.dio.post('/auth/change-password', data: {
        'currentPassword': current,
        'newPassword': newPassword,
      });
      final data = _parseResponseMap(response.data);
      final accessToken = _readAccessToken(data);
      final userJson =
          _normalizeOptionalUserJson(_parseUserMapOptional(data['user']));
      if (accessToken == null || userJson == null) {
        final token = await _storage.getToken();
        emit(AuthMustChangePassword(
          token ?? '',
          bannerMessage: 'Password change failed: unexpected server response.',
        ));
        return;
      }
      await _completeLogin(
          accessToken, data['refreshToken'] as String?, userJson);
    } catch (e) {
      final token = await _storage.getToken();
      emit(AuthMustChangePassword(
        token ?? '',
        bannerMessage: apiError(e, fallback: 'Failed to change password.'),
      ));
    }
  }

  Future<void> updateProfile(Map<String, dynamic> updates) async {
    try {
      await _client.dio.put('/auth/me', data: updates);
      await checkAuthStatus();
    } catch (e) {
      emit(AuthError('Failed to update profile: $e'));
    }
  }

  Future<void> updatePreferences(Map<String, dynamic> prefs) async {
    try {
      await _client.dio.put('/auth/preferences', data: prefs);
    } catch (_) {}
  }

  Future<void> uploadIdentityPhoto(
    File photo, {
    required File idCardFront,
    required File idCardBack,
  }) async {
    try {
      final bytes = await photo.readAsBytes();
      final frontBytes = await idCardFront.readAsBytes();
      final backBytes = await idCardBack.readAsBytes();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final formData = buildMultipartForm(
        files: {
          'photo': jpegMultipartFromBytes(
            bytes,
            filename: 'identity_$timestamp.jpg',
          ),
          'idCardFront': jpegMultipartFromBytes(
            frontBytes,
            filename: 'id_front_$timestamp.jpg',
          ),
          'idCardBack': jpegMultipartFromBytes(
            backBytes,
            filename: 'id_back_$timestamp.jpg',
          ),
        },
      );
      await _client.dio.post('/verify/identity', data: formData);
      await checkAuthStatus();
    } catch (e) {
      emit(
          AuthError(apiError(e, fallback: 'Failed to upload identity photo.')));
    }
  }

  Future<void> logout() async {
    emit(AuthLoading());
    _pendingLoginPassword = null;
    try {
      await getIt<MobilePushService>().unregister();
    } catch (_) {}
    try {
      await _client.dio.post('/auth/logout');
    } catch (_) {}
    await _storage.clearAuthFlow();
    emit(AuthUnauthenticated());
  }

  Future<void> _persistPendingDeviceVerification(
    String userId,
    String verificationToken,
  ) async {
    await _storage.savePendingDeviceVerification(jsonEncode({
      'userId': userId,
      'verificationToken': verificationToken,
      'savedAt': DateTime.now().toIso8601String(),
    }));
  }

  Future<bool> _restorePendingDeviceVerification() async {
    final raw = await _storage.getPendingDeviceVerification();
    if (raw == null || raw.isEmpty) return false;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final userId = map['userId']?.toString();
      final token = map['verificationToken']?.toString() ?? '';
      if (userId == null || userId.isEmpty) return false;
      emit(AuthDeviceUnverified(userId, token));
      return true;
    } catch (_) {
      await _storage.clearPendingDeviceVerification();
      return false;
    }
  }

  Map<String, dynamic>? _normalizeOptionalUserJson(Map<String, dynamic>? json) {
    return json == null ? null : _normalizeUserJson(json);
  }

  Map<String, dynamic> _normalizeUserJson(Map<String, dynamic> json) {
    final normalized = Map<String, dynamic>.from(json);
    if (normalized['mustChangePassword'] == null &&
        normalized['must_change_password'] != null) {
      normalized['mustChangePassword'] = normalized['must_change_password'];
    }
    if (normalized['identityVerified'] == null &&
        normalized['identity_verified'] != null) {
      normalized['identityVerified'] = normalized['identity_verified'];
    }
    if (normalized['avatarUrl'] == null &&
        normalized['profile_photo_url'] != null) {
      normalized['avatarUrl'] = normalized['profile_photo_url'];
    }
    return normalized;
  }

  String? _readAccessToken(Map<String, dynamic> data) {
    final token = data['accessToken'] ?? data['token'];
    if (token == null) return null;
    final value = token.toString().trim();
    return value.isEmpty ? null : value;
  }

  Map<String, dynamic> _parseResponseMap(dynamic responseData) {
    if (responseData is String) {
      return jsonDecode(responseData) as Map<String, dynamic>;
    }
    if (responseData is Map) {
      return Map<String, dynamic>.from(responseData);
    }
    throw Exception('Unexpected response format: ${responseData.runtimeType}');
  }

  Map<String, dynamic> _parseUserMap(dynamic rawUser) {
    final parsed = _parseUserMapOptional(rawUser);
    if (parsed == null) {
      throw Exception('Missing user data in response');
    }
    return parsed;
  }

  Map<String, dynamic>? _parseUserMapOptional(dynamic rawUser) {
    if (rawUser is String) {
      return jsonDecode(rawUser) as Map<String, dynamic>;
    }
    if (rawUser is Map) {
      return Map<String, dynamic>.from(rawUser);
    }
    return null;
  }

  bool _isAuthFailure(dynamic e) {
    if (e is! DioException) return false;
    final status = e.response?.statusCode;
    return status == 401 || status == 403;
  }

  String _extractErrorMessage(dynamic e) => apiError(e);
}
