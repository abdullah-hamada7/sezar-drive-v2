import 'dart:async';
import 'dart:io';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:dio/dio.dart';
import '../network/dio_client.dart';
import 'websocket_service.dart';
import '../utils/parsers.dart';

/// Sends driver GPS updates via WebSocket (primary) with REST fallback.
class LocationService {
  final DioClient _client;
  final WebSocketService _ws;
  StreamSubscription<Position>? _positionStreamSubscription;
  Timer? _throttleTimer;
  bool _isTracking = false;
  String? _shiftId;
  String? _tripId;
  DateTime? _lastSentAt;

  late final Dio _nominatimDio;

  static const Duration _minInterval = Duration(seconds: 10);
  static const int _locationBufferMax = 60;
  final List<Map<String, dynamic>> _locationBuffer = [];

  LocationService(this._client, this._ws) {
    _nominatimDio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'SezarDriverMobile/1.0.0 (contact: support@sezardrive.com)',
      },
    ));
  }

  Future<bool> requestPermissions() async {
    final status = await Permission.location.request();
    if (!status.isGranted) return false;
    if (Platform.isAndroid) {
      await Permission.locationAlways.request();
    }
    return true;
  }

  Future<void> startTracking({String? shiftId, String? tripId}) async {
    _shiftId = shiftId;
    _tripId = tripId;

    if (_isTracking) return;

    final hasPermission = await requestPermissions();
    if (!hasPermission) return;

    _isTracking = true;

    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 30,
    );

    _positionStreamSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(
      (position) => _onPosition(position),
      onError: (_) {},
    );
  }

  void _onPosition(Position position) {
    final now = DateTime.now();
    if (_lastSentAt != null && now.difference(_lastSentAt!) < _minInterval) {
      return;
    }
    _lastSentAt = now;

    final payload = {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'speed': position.speed,
      'heading': position.heading,
      'accuracy': position.accuracy,
      'recordedAt': now.toIso8601String(),
    };

    _sendLocation(payload);
  }

  Future<void> _sendLocation(Map<String, dynamic> payload) async {
    final sent = _ws.sendLocationUpdate(
      shiftId: _shiftId,
      tripId: _tripId,
      payload: payload,
    );

    if (!sent) {
      _bufferLocation(payload);
      await _sendRestFallback(payload);
    }
  }

  void _bufferLocation(Map<String, dynamic> payload) {
    _locationBuffer.add({
      'shiftId': _shiftId,
      'tripId': _tripId,
      'payload': payload,
    });
    while (_locationBuffer.length > _locationBufferMax) {
      _locationBuffer.removeAt(0);
    }
  }

  Future<void> _sendRestFallback(Map<String, dynamic> payload) async {
    try {
      await _client.dio.post('/tracking/location', data: {
        ...payload,
        'shiftId': _shiftId,
        'tripId': _tripId,
      });
    } catch (_) {
      // Silent — tracking must not block driver flows.
    }
  }

  void flushBuffer() {
    if (!_ws.isConnected || _locationBuffer.isEmpty) return;
    final buffer = List<Map<String, dynamic>>.from(_locationBuffer);
    _locationBuffer.clear();
    for (final item in buffer) {
      _ws.sendLocationUpdate(
        shiftId: item['shiftId'] as String?,
        tripId: item['tripId'] as String?,
        payload: Map<String, dynamic>.from(item['payload'] as Map),
      );
    }
  }

  Future<void> stopTracking() async {
    await _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    _throttleTimer?.cancel();
    _isTracking = false;
    _shiftId = null;
    _tripId = null;
    _lastSentAt = null;
  }

  void updateContext({String? shiftId, String? tripId}) {
    _shiftId = shiftId;
    _tripId = tripId;
  }

  Future<Position?> getCurrentLocation() async {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 5),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  Future<String?> reverseGeocode(double lat, double lng) async {
    try {
      final response = await _nominatimDio.get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'format': 'jsonv2',
          'lat': lat.toString(),
          'lon': lng.toString(),
          'zoom': '18',
          'addressdetails': '1',
        },
      );
      final dataMap = parseResponseMap(response.data);
      return dataMap['display_name']?.toString();
    } catch (_) {
      return null;
    }
  }
}
