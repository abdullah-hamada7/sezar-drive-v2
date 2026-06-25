import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'driver_alert_events.dart';

/// Shows native Android notifications for real-time driver events while the app
/// is running. Backend web-push (VAPID) is PWA-only; this mirrors that UX on mobile.
class LocalNotificationService {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  static const _channelId = 'sezar_driver_events';
  static const _channelName = 'Driver Alerts';

  Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _plugin.initialize(initSettings);

    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: 'Real-time trip, shift, and account notifications',
      importance: Importance.high,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    _initialized = true;
  }

  Future<void> showEvent(
    String eventType, {
    Map<String, dynamic>? data,
  }) async {
    if (!_initialized) return;

    final title = DriverAlertEvents.titleFor(eventType);
    final body = _resolveBody(eventType, data);
    if (body.isEmpty) return;

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        importance: Importance.high,
        priority: Priority.high,
      ),
    );

    await _plugin.show(
      eventType.hashCode,
      title,
      body,
      details,
    );
  }

  String _resolveBody(String eventType, Map<String, dynamic>? data) {
    final fallback = DriverAlertEvents.messageFor(eventType);
    if (fallback != null) return fallback;
    if (data == null) return '';
    final message = data['message'] ?? data['body'];
    return message?.toString() ?? '';
  }

  Future<void> show({required String title, required String body}) async {
    if (!_initialized) await init();
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        importance: Importance.high,
        priority: Priority.high,
      ),
    );
    await _plugin.show(title.hashCode, title, body, details);
  }
}
