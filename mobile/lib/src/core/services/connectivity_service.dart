import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Monitors device network connectivity and exposes a broadcast stream.
class ConnectivityService {
  final Connectivity _connectivity = Connectivity();
  final StreamController<bool> _controller = StreamController<bool>.broadcast();
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _isOnline = true;

  Stream<bool> get onConnectivityChanged => _controller.stream;
  bool get isOnline => _isOnline;

  Future<void> start() async {
    final initial = await _connectivity.checkConnectivity();
    _isOnline = _hasConnection(initial);
    _controller.add(_isOnline);

    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      final online = _hasConnection(results);
      if (online != _isOnline) {
        _isOnline = online;
        _controller.add(online);
      }
    });
  }

  bool _hasConnection(List<ConnectivityResult> results) {
    return results.any((r) => r != ConnectivityResult.none);
  }

  Future<bool> checkNow() async {
    final results = await _connectivity.checkConnectivity();
    _isOnline = _hasConnection(results);
    return _isOnline;
  }

  void dispose() {
    _subscription?.cancel();
    _controller.close();
  }
}
