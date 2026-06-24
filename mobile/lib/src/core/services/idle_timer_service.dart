import 'dart:async';
import 'package:flutter/material.dart';

class IdleTimerService with WidgetsBindingObserver {
  static const Duration _idleTimeout = Duration(minutes: 30);
  Timer? _idleTimer;
  VoidCallback? _onTimeout;
  bool _isRunning = false;

  void start(VoidCallback onTimeout) {
    _onTimeout = onTimeout;
    _isRunning = true;
    WidgetsBinding.instance.addObserver(this);
    _resetTimer();
  }

  void stop() {
    _isRunning = false;
    _idleTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }

  void reset() {
    if (_isRunning) {
      _resetTimer();
    }
  }

  void _resetTimer() {
    _idleTimer?.cancel();
    _idleTimer = Timer(_idleTimeout, () {
      if (_isRunning && _onTimeout != null) {
        _onTimeout!();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      reset();
    }
  }

  /// Call this from any user interaction (taps, scrolls, etc.)
  static void notifyInteraction(IdleTimerService? service) {
    service?.reset();
  }

  void dispose() {
    stop();
  }
}
