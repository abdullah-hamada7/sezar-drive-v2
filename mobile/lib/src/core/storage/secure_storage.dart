import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  static const String _tokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'user_profile';
  static const String _fingerprintKey = 'device_fingerprint';

  Future<void> saveToken(String token) async {
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {}
  }

  Future<String?> getToken() async {
    try {
      return await _storage.read(key: _tokenKey);
    } catch (_) {
      await deleteToken();
      return null;
    }
  }

  Future<void> deleteToken() async {
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {}
  }

  Future<void> saveRefreshToken(String token) async {
    try {
      await _storage.write(key: _refreshTokenKey, value: token);
    } catch (_) {}
  }

  Future<String?> getRefreshToken() async {
    try {
      return await _storage.read(key: _refreshTokenKey);
    } catch (_) {
      await deleteRefreshToken();
      return null;
    }
  }

  Future<void> deleteRefreshToken() async {
    try {
      await _storage.delete(key: _refreshTokenKey);
    } catch (_) {}
  }

  Future<void> saveUserProfile(String userJson) async {
    try {
      await _storage.write(key: _userKey, value: userJson);
    } catch (_) {}
  }

  Future<String?> getUserProfile() async {
    try {
      return await _storage.read(key: _userKey);
    } catch (_) {
      await deleteUserProfile();
      return null;
    }
  }

  Future<void> deleteUserProfile() async {
    try {
      await _storage.delete(key: _userKey);
    } catch (_) {}
  }

  Future<void> saveDeviceFingerprint(String fingerprint) async {
    try {
      await _storage.write(key: _fingerprintKey, value: fingerprint);
    } catch (_) {}
  }

  Future<String?> getDeviceFingerprint() async {
    try {
      final val = await _storage.read(key: _fingerprintKey);
      if (val == null || val.trim().isEmpty) return null;
      return val;
    } catch (_) {
      try {
        await _storage.delete(key: _fingerprintKey);
      } catch (_) {}
      return null;
    }
  }

  /// Clears auth session but keeps device fingerprint for device-trust flow.
  Future<void> clearSession() async {
    await deleteToken();
    await deleteRefreshToken();
    await deleteUserProfile();
  }

  Future<void> clearAll() async {
    try {
      await _storage.deleteAll();
    } catch (_) {}
  }
}
