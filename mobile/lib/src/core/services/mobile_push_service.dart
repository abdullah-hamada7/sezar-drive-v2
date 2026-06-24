import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
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
  bool _firebaseReady = false;

  MobilePushService(this._local, this._client, this._storage);

  Future<void> init() async {
    await _local.init();
    await _initFirebase();
  }

  Future<void> _initFirebase() async {
    try {
      if (DefaultFirebaseOptions.isConfigured) {
        await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      } else {
        // Uses google-services.json on Android / GoogleService-Info.plist on iOS
        await Firebase.initializeApp();
      }
      final messaging = FirebaseMessaging.instance;

      if (Platform.isIOS) {
        await messaging.requestPermission(alert: true, badge: true, sound: true);
      } else {
        await messaging.requestPermission();
      }

      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      FirebaseMessaging.onMessage.listen((message) {
        final title = message.notification?.title ?? 'Sezar Driver';
        final body = message.notification?.body ?? '';
        if (body.isNotEmpty) {
          _local.show(title: title, body: body);
        }
      });

      messaging.onTokenRefresh.listen(_registerToken);
      _firebaseReady = true;

      final token = await messaging.getToken();
      if (token != null) {
        await _registerToken(token);
      }
    } catch (e) {
      debugPrint('[MobilePush] Firebase init failed: $e');
      _firebaseReady = false;
    }
  }

  Future<void> registerAfterLogin() async {
    if (!_firebaseReady) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _registerToken(token);
    } catch (e) {
      debugPrint('[MobilePush] registerAfterLogin failed: $e');
    }
  }

  Future<void> unregister() async {
    if (_currentToken != null) {
      try {
        await _client.dio.post(
          '/push/unregister-device',
          data: {'token': _currentToken},
        );
      } catch (e) {
        debugPrint('[MobilePush] unregister failed: $e');
      }
    }
    _currentToken = null;
    if (_firebaseReady) {
      try {
        await FirebaseMessaging.instance.deleteToken();
      } catch (e) {
        debugPrint('[MobilePush] deleteToken failed: $e');
      }
    }
  }

  Future<void> _registerToken(String token) async {
    _currentToken = token;
    final accessToken = await _storage.getToken();
    if (accessToken == null || accessToken.isEmpty) {
      debugPrint('[MobilePush] Skip registering token: not logged in.');
      return;
    }
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
}
