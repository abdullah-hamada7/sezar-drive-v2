import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../firebase_options.dart';
import '../../../firebase_background.dart';
import '../network/dio_client.dart';
import '../storage/secure_storage.dart';
import 'local_notification_service.dart';

class MobilePushService {
  final LocalNotificationService _local;
  final DioClient _client;
  final SecureStorage _storage;
  String? _currentToken;
  String? _pendingFcmToken;
  bool _firebaseReady = false;
  bool _allowServerRegistration = false;

  MobilePushService(this._local, this._client, this._storage);

  Future<void> init() async {
    await _local.init();
    await _initFirebase();
  }

  Future<void> _initFirebase() async {
    try {
      if (DefaultFirebaseOptions.isConfigured) {
        await Firebase.initializeApp(
            options: DefaultFirebaseOptions.currentPlatform);
      } else {
        await Firebase.initializeApp();
      }
      final messaging = FirebaseMessaging.instance;

      if (Platform.isIOS) {
        await messaging.requestPermission(
            alert: true, badge: true, sound: true);
      } else {
        await _requestAndroidNotificationPermission();
        await messaging.requestPermission();
      }

      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      FirebaseMessaging.onMessage.listen((message) {
        final data = message.data;
        final title = message.notification?.title ??
            data['title']?.toString() ??
            'Sezar Driver';
        final body = message.notification?.body?.toString() ??
            data['body']?.toString() ??
            '';
        if (body.isNotEmpty) {
          _local.show(title: title, body: body);
        }
      });

      messaging.onTokenRefresh.listen((token) {
        _pendingFcmToken = token;
        if (_allowServerRegistration) {
          _registerToken(token);
        }
      });
      _firebaseReady = true;

      final token = await messaging.getToken();
      if (token != null) {
        _pendingFcmToken = token;
      }
    } catch (e) {
      debugPrint('[MobilePush] Firebase init failed: $e');
      _firebaseReady = false;
    }
  }

  /// Call after a full authenticated session exists (post login or verify-device).
  Future<void> registerAfterLogin() async {
    if (!_firebaseReady) return;
    _allowServerRegistration = true;
    try {
      final token =
          _pendingFcmToken ?? await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _registerToken(token);
      }
    } catch (e) {
      debugPrint('[MobilePush] registerAfterLogin failed: $e');
    }
  }

  /// Call when session is cleared (logout or pending device verification).
  void onSessionCleared() {
    _allowServerRegistration = false;
    _currentToken = null;
  }

  Future<void> unregister() async {
    final tokenToUnregister = _currentToken;
    onSessionCleared();
    if (tokenToUnregister != null) {
      try {
        await _client.dio.post(
          '/push/unregister-device',
          data: {'token': tokenToUnregister},
        );
      } catch (e) {
        debugPrint('[MobilePush] unregister failed: $e');
      }
    }
    _currentToken = null;
    if (_firebaseReady) {
      try {
        await FirebaseMessaging.instance.deleteToken();
        _pendingFcmToken = null;
      } catch (e) {
        debugPrint('[MobilePush] deleteToken failed: $e');
      }
    }
  }

  Future<void> _registerToken(String token) async {
    if (!_allowServerRegistration) {
      _pendingFcmToken = token;
      return;
    }

    final accessToken = await _storage.getToken();
    if (accessToken == null || accessToken.isEmpty) {
      _pendingFcmToken = token;
      debugPrint(
          '[MobilePush] Deferring token registration until authenticated.');
      return;
    }

    _currentToken = token;
    _pendingFcmToken = token;
    try {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _client.dio.post(
        '/push/register-device',
        data: {'token': token, 'platform': platform},
      );
    } catch (e) {
      debugPrint('[MobilePush] Token registration failed: $e');
    }
  }

  Future<void> showEvent(String eventType) => _local.showEvent(eventType);

  Future<bool> _requestAndroidNotificationPermission() async {
    if (!Platform.isAndroid) return true;
    final status = await Permission.notification.status;
    if (status.isGranted) return true;
    if (status.isPermanentlyDenied) return false;
    final result = await Permission.notification.request();
    return result.isGranted;
  }
}
