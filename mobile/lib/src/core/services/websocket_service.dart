import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/app_config.dart';
import '../network/dio_client.dart';
import '../storage/secure_storage.dart';
import '../../features/trip/cubit/trip_cubit.dart';
import '../../features/notifications/cubit/notification_cubit.dart';
import '../../features/home/cubit/home_cubit.dart';
import '../../features/shift/cubit/shift_cubit.dart';
import '../../features/violations/cubit/violation_cubit.dart';
import '../../features/badges/cubit/badge_cubit.dart';
import 'local_notification_service.dart';
import 'driver_alert_events.dart';
import '../utils/realtime_guard.dart';
import '../utils/parsers.dart';

enum WsEventType {
  tripAssigned,
  tripAccepted,
  tripCancelled,
  tripCompleted,
  tripUpdated,
  shiftStarted,
  shiftActivated,
  shiftClosed,
  shiftUpdated,
  expenseUpdate,
  expenseReviewed,
  damageUpdate,
  damageReviewed,
  inspectionCreated,
  inspectionPhotoUploaded,
  inspectionCompleted,
  update,
  identityUpdate,
  violationCreated,
  unknown,
}

class WsEvent {
  final WsEventType type;
  final Map<String, dynamic> data;
  final String rawType;
  WsEvent({required this.type, required this.data, required this.rawType});
}

class WebSocketService {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  bool _isConnected = false;
  bool _shouldReconnect = true;
  String? _token;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 20;
  static const Duration _reconnectDelay = Duration(seconds: 5);

  final SecureStorage _storage;
  final DioClient? _dioClient;
  final LocalNotificationService? _localNotifications;

  final StreamController<WsEvent> _eventController = StreamController<WsEvent>.broadcast();
  Stream<WsEvent> get events => _eventController.stream;

  final List<void Function(bool)> _connectionListeners = [];

  WebSocketService(this._storage, {DioClient? dioClient, LocalNotificationService? localNotifications})
      : _dioClient = dioClient,
        _localNotifications = localNotifications;

  String _buildWsUrl(String token) => '${AppConfig.wsBaseUrl}/ws/tracking?token=$token';

  Future<void> connect() async {
    if (_isConnected) return;
    _token = await _storage.getToken();
    if (_token == null) return;

    _shouldReconnect = true;
    await _doConnect();
  }

  Future<void> _doConnect() async {
    try {
      _token = await _storage.getToken();
      if (_token == null) return;

      _channel = WebSocketChannel.connect(Uri.parse(_buildWsUrl(_token!)));
      _isConnected = true;
      _reconnectAttempts = 0;
      RealtimeGuard.resetStream('driver');
      _notifyConnectionListeners(true);

      _subscription = _channel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message as String) as Map<String, dynamic>;
            _handleMessage(data);
          } catch (_) {}
        },
        onError: (_) {
          _handleDisconnect();
        },
        onDone: () {
          _handleDisconnect();
        },
      );

      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
        try {
          _channel?.sink.add(jsonEncode({'type': 'ping'}));
        } catch (_) {}
      });
    } catch (_) {
      _isConnected = false;
      _scheduleReconnect();
    }
  }

  void _handleDisconnect() {
    _isConnected = false;
    _notifyConnectionListeners(false);
    _scheduleReconnect();
  }

  void _handleMessage(Map<String, dynamic> message) {
    final type = message['type'] as String? ?? '';
    if (type == 'ping' || type == 'pong' || type == 'initial_positions') return;

    final guard = RealtimeGuard.evaluate('driver', type, message);
    if (guard.gapDetected) {
      _eventController.add(WsEvent(type: WsEventType.update, data: message, rawType: 'update'));
    }

    final eventType = _mapEventType(type);
    _eventController.add(WsEvent(type: eventType, data: message, rawType: type));

    if (_localNotifications != null &&
        DriverAlertEvents.alertTypes.contains(type)) {
      _localNotifications!.showEvent(type, data: message);
    }
  }

  WsEventType _mapEventType(String type) {
    switch (type) {
      case 'trip_assigned':
        return WsEventType.tripAssigned;
      case 'trip_accepted':
        return WsEventType.tripAccepted;
      case 'trip_cancelled':
        return WsEventType.tripCancelled;
      case 'trip_completed':
        return WsEventType.tripCompleted;
      case 'trip_updated':
        return WsEventType.tripUpdated;
      case 'shift_started':
        return WsEventType.shiftStarted;
      case 'shift_activated':
        return WsEventType.shiftActivated;
      case 'shift_closed':
        return WsEventType.shiftClosed;
      case 'shift_updated':
        return WsEventType.shiftUpdated;
      case 'expense_update':
        return WsEventType.expenseUpdate;
      case 'expense_reviewed':
        return WsEventType.expenseReviewed;
      case 'damage_update':
        return WsEventType.damageUpdate;
      case 'damage_reviewed':
        return WsEventType.damageReviewed;
      case 'inspection_created':
        return WsEventType.inspectionCreated;
      case 'inspection_photo_uploaded':
        return WsEventType.inspectionPhotoUploaded;
      case 'inspection_completed':
        return WsEventType.inspectionCompleted;
      case 'update':
        return WsEventType.update;
      case 'identity_update':
        return WsEventType.identityUpdate;
      case 'violation_created':
        return WsEventType.violationCreated;
      default:
        return WsEventType.unknown;
    }
  }

  /// Returns true if the message was sent on the open socket.
  bool sendLocationUpdate({
    String? shiftId,
    String? tripId,
    required Map<String, dynamic> payload,
  }) {
    if (!_isConnected || _channel == null) return false;
    try {
      _channel!.sink.add(jsonEncode({
        'type': 'location_update',
        'shiftId': shiftId,
        'tripId': tripId,
        'payload': payload,
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  void _scheduleReconnect() {
    if (!_shouldReconnect) return;
    if (_reconnectAttempts >= _maxReconnectAttempts) return;

    _reconnectAttempts++;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(_reconnectDelay, () async {
      // Refresh token before reconnecting (mirrors web tryRefresh).
      if (_dioClient != null) {
        final refreshToken = await _storage.getRefreshToken();
        if (refreshToken != null) {
          try {
            final res = await _dioClient!.dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
            final dataMap = parseResponseMap(res.data);
            final newToken = dataMap['accessToken'] as String?;
            if (newToken != null) {
              await _storage.saveToken(newToken);
            }
          } catch (_) {}
        }
      }
      await _doConnect();
    });
  }

  Future<void> disconnect() async {
    _shouldReconnect = false;
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close();
    _channel = null;
    _isConnected = false;
    _notifyConnectionListeners(false);
  }

  bool get isConnected => _isConnected;

  void addConnectionListener(void Function(bool) listener) {
    _connectionListeners.add(listener);
  }

  void removeConnectionListener(void Function(bool) listener) {
    _connectionListeners.remove(listener);
  }

  void _notifyConnectionListeners(bool connected) {
    for (final l in _connectionListeners) {
      try {
        l(connected);
      } catch (_) {}
    }
  }

  void dispose() {
    disconnect();
    _eventController.close();
  }

  static const Map<String, String> eventMessages = DriverAlertEvents.messages;

  static String? eventMessage(String type) => DriverAlertEvents.messageFor(type);

  static void notifyRelevantCubits(
    WsEvent event,
    TripCubit? tripCubit,
    ShiftCubit? shiftCubit,
    HomeCubit? homeCubit,
    NotificationCubit? notificationCubit,
    ViolationCubit? violationCubit,
    BadgeCubit? badgeCubit,
  ) {
    if (DriverAlertEvents.alertTypes.contains(event.rawType)) {
      notificationCubit?.fetchNotifications();
      badgeCubit?.fetchCounts();
    }

    switch (event.type) {
      case WsEventType.tripAssigned:
      case WsEventType.tripAccepted:
      case WsEventType.tripCancelled:
      case WsEventType.tripCompleted:
      case WsEventType.tripUpdated:
        tripCubit?.fetchMyTrips();
        homeCubit?.fetchHomeData();
        break;
      case WsEventType.shiftStarted:
      case WsEventType.shiftActivated:
      case WsEventType.shiftClosed:
      case WsEventType.shiftUpdated:
        shiftCubit?.fetchActiveShift(silent: true);
        break;
      case WsEventType.expenseUpdate:
      case WsEventType.expenseReviewed:
        homeCubit?.fetchHomeData();
        break;
      case WsEventType.damageUpdate:
      case WsEventType.damageReviewed:
        homeCubit?.fetchHomeData();
        break;
      case WsEventType.identityUpdate:
        homeCubit?.fetchHomeData();
        break;
      case WsEventType.violationCreated:
        violationCubit?.fetchMyViolations();
        homeCubit?.fetchHomeData();
        break;
      case WsEventType.update:
        tripCubit?.fetchMyTrips();
        shiftCubit?.fetchActiveShift(silent: true);
        homeCubit?.fetchHomeData();
        break;
      case WsEventType.inspectionCreated:
      case WsEventType.inspectionPhotoUploaded:
      case WsEventType.inspectionCompleted:
        badgeCubit?.fetchCounts();
        break;
      case WsEventType.unknown:
        break;
    }
  }
}
