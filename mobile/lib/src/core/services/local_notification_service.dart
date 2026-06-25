import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Shows native Android notifications for real-time driver events while the app
/// is running. Backend web-push (VAPID) is PWA-only; this mirrors that UX on mobile.
class LocalNotificationService {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  static const _channelId = 'sezar_driver_events';
  static const _channelName = 'Driver Alerts';

  static const Map<String, String> _eventMessages = {
    'trip_assigned': 'A new trip was assigned to you',
    'trip_accepted': 'Trip accepted successfully',
    'trip_completed': 'Trip completed successfully',
    'trip_cancelled': 'A trip was cancelled',
    'shift_started': 'Your shift request was created',
    'shift_activated': 'Your shift was activated',
    'shift_closed': 'Your shift was closed',
    'damage_reviewed': 'Your damage report was reviewed',
    'expense_reviewed': 'Your expense was reviewed',
    'identity_update': 'Your identity verification status was updated',
  };

  Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _plugin.initialize(initSettings);

    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: 'Real-time trip and shift notifications',
      importance: Importance.high,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    _initialized = true;
  }

  Future<void> showEvent(String eventType) async {
    if (!_initialized) return;
    final body = _eventMessages[eventType];
    if (body == null) return;

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
      'Sezar Drive',
      body,
      details,
    );
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
