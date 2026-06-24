import 'dart:convert';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/multipart_form.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';
import '../../../core/services/service_locator.dart';
import '../../../core/services/mobile_push_service.dart';
import '../../../core/services/session_revoked_notifier.dart';

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
  List<Object?> get props => [user.id, user.email, user.name, user.identityVerified];
}
class AuthUnauthenticated extends AuthState {}
class AuthMustChangePassword extends AuthState {
  final String tempToken;
  const AuthMustChangePassword(this.tempToken);

  @override
  List<Object?> get props => [tempToken];
}
class AuthDeviceUnverified extends AuthState {
  final String userId;
  final String verificationToken;
  final String? bannerMessage;
  const AuthDeviceUnverified(this.userId, this.verificationToken, {this.bannerMessage});

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

  AuthCubit(this._client, this._storage, SessionRevokedNotifier sessionRevoked)
      : super(AuthInitial()) {
    sessionRevoked.onSessionRevoked = () => handleSessionRevoked();
  }

  Future<void> handleSessionRevoked() async {
    if (isClosed || state is AuthUnauthenticated) return;
    await _storage.clearSession();
    getIt<MobilePushService>().onSessionCleared();
    emit(AuthUnauthenticated());
  }

  Future<void> cancelDeviceVerification() async {
    await _storage.clearSession();
    getIt<MobilePushService>().onSessionCleared();
    emit(AuthUnauthenticated());
  }

  Future<void> checkAuthStatus() async {
    final token = await _storage.getToken();
    if (token == null) {
      emit(AuthUnauthenticated());
      return;
    }

    try {
      final response = await _client.dio.get('/auth/me');
      final data = _parseResponseMap(response.data);
      final userJson = _parseUserMap(data['user']);
      final user = User.fromJson(userJson);
      await _storage.saveUserProfile(jsonEncode(userJson));
      if (user.mustChangePassword) {
        emit(AuthMustChangePassword(token));
      } else {
        emit(AuthAuthenticated(user));
        await getIt<MobilePushService>().registerAfterLogin();
      }
    } catch (e) {
      if (_isAuthFailure(e)) {
        await _storage.clearSession();
        emit(AuthUnauthenticated());
        return;
      }
      final cached = await _storage.getUserProfile();
      if (cached != null) {
        try {
          final user = User.fromJson(jsonDecode(cached) as Map<String, dynamic>);
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
    try {
      var fingerprint = await _storage.getDeviceFingerprint();
      if (fingerprint == null || fingerprint.trim().isEmpty) {
        fingerprint = const Uuid().v4();
        await _storage.saveDeviceFingerprint(fingerprint);
      }
      final response = await _client.dio.post('/auth/login', data: {
        'email': email.trim(),
        'password': password,
        'deviceFingerprint': fingerprint,
      });

      final data = _parseResponseMap(response.data);

      final requiresVerification = parseBool(data['requiresVerification'], false);
      if (requiresVerification) {
        final userId = data['userId'] as String? ?? email;
        final verificationToken = (data['verificationToken'] ?? data['verification_token']) as String? ?? '';
        await _storage.clearSession();
        getIt<MobilePushService>().onSessionCleared();
        emit(AuthDeviceUnverified(userId, verificationToken));
        return;
      }

      final mustChangePassword = parseBool(data['mustChangePassword'], false);
      if (mustChangePassword) {
        final tempToken = data['accessToken'] as String?;
        if (tempToken != null) {
          await _storage.saveToken(tempToken);
        }
        emit(AuthMustChangePassword(tempToken ?? ''));
        return;
      }

      final accessToken = data['accessToken'] as String?;
      final userJson = _parseUserMapOptional(data['user']);

      if (accessToken != null && userJson != null) {
        await _completeLogin(accessToken, data['refreshToken'] as String?, userJson);
      } else {
        emit(const AuthError('Login failed: unexpected server response.'));
      }
    } catch (e) {
      emit(AuthError(_extractErrorMessage(e)));
    }
  }

  Future<void> verifyDevice(String userId, String verificationToken, XFile selfieFile) async {
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
      };
      if (verificationToken.isNotEmpty) {
        fields['verificationToken'] = verificationToken;
      }
      final formData = buildMultipartForm(
        fields: fields,
        files: {
          'photo': jpegMultipartFromBytes(
            bytes,
            filename: 'device_selfie_${DateTime.now().millisecondsSinceEpoch}.jpg',
          ),
        },
      );
      final response = await _client.dio.post('/auth/verify-device', data: formData);

      final data = _parseResponseMap(response.data);
      final accessToken = data['accessToken'] as String?;
      final userJson = _parseUserMapOptional(data['user']);

      if (accessToken == null || userJson == null) {
        emit(const AuthError('Device verification failed: unexpected server response.'));
        return;
      }

      await _completeLogin(accessToken, data['refreshToken'] as String?, userJson);
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
    final user = User.fromJson(userJson);
    await _storage.saveUserProfile(jsonEncode(userJson));
    if (user.mustChangePassword) {
      emit(AuthMustChangePassword(accessToken));
    } else {
      emit(AuthAuthenticated(user));
      await getIt<MobilePushService>().registerAfterLogin();
    }
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    emit(AuthLoading());
    try {
      await _client.dio.post('/auth/change-password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
      emit(AuthPasswordChanged());
      await checkAuthStatus();
    } catch (e) {
      emit(AuthError(apiError(e, fallback: 'Failed to change password.')));
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

  Future<void> uploadIdentityPhoto(File photo) async {
    try {
      final bytes = await photo.readAsBytes();
      final formData = buildMultipartForm(
        files: {
          'photo': jpegMultipartFromBytes(
            bytes,
            filename: 'identity_${DateTime.now().millisecondsSinceEpoch}.jpg',
          ),
        },
      );
      await _client.dio.post('/verify/identity', data: formData);
      await checkAuthStatus();
    } catch (e) {
      emit(AuthError(apiError(e, fallback: 'Failed to upload identity photo.')));
    }
  }

  Future<void> logout() async {
    emit(AuthLoading());
    try {
      await getIt<MobilePushService>().unregister();
    } catch (_) {}
    try {
      await _client.dio.post('/auth/logout');
    } catch (_) {}
    await _storage.clearSession();
    emit(AuthUnauthenticated());
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
