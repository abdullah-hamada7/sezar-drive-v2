import 'dart:async';
import '../network/dio_client.dart';
import 'location_service.dart';
import 'websocket_service.dart';
import '../utils/parsers.dart';

/// Coordinates WebSocket connection and GPS tracking when shift is active.
class DriverTrackingService {
  final DioClient _client;
  final WebSocketService _ws;
  final LocationService _location;
  Timer? _pollTimer;
  bool _running = false;

  DriverTrackingService(this._client, this._ws, this._location);

  void start() {
    if (_running) return;
    _running = true;

    _ws.connect();
    _ws.addConnectionListener(_onWsConnectionChanged);
    _pollActiveShift();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _pollActiveShift());
  }

  void _onWsConnectionChanged(bool connected) {
    if (connected) {
      _location.flushBuffer();
    }
  }

  Future<void> _pollActiveShift() async {
    try {
      final response = await _client.dio.get('/shifts/active');
      final dataMap = parseResponseMap(response.data);
      final shift = dataMap['shift'] != null ? Map<String, dynamic>.from(dataMap['shift'] as Map) : null;

      if (shift != null) {
        final status = shift['status'] as String? ?? '';
        final shiftId = shift['id'] as String?;
        final tripId = shift['currentTripId'] as String?; // optional — not always returned by API

        if (status == 'Active') {
          if (!_ws.isConnected) {
            await _ws.connect();
          }
          _location.updateContext(shiftId: shiftId, tripId: tripId);
          await _location.startTracking(shiftId: shiftId, tripId: tripId);
        } else {
          await _location.stopTracking();
        }
      } else {
        await _location.stopTracking();
      }
    } catch (_) {
      // Silent: do not kill tracking on transient API check failures.
      // This ensures offline locations continue buffering in the background.
    }
  }

  void stop() {
    _running = false;
    _pollTimer?.cancel();
    _ws.removeConnectionListener(_onWsConnectionChanged);
    _location.stopTracking();
  }

  void dispose() {
    stop();
  }
}
