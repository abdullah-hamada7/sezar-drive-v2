import 'package:flutter_test/flutter_test.dart';
import 'package:sezar_driver/src/core/services/driver_alert_events.dart';
import 'package:sezar_driver/src/core/services/websocket_service.dart';

void main() {
  test('driver alert events stay aligned with websocket messages', () {
    for (final type in DriverAlertEvents.alertTypes) {
      expect(
        DriverAlertEvents.messageFor(type),
        isNotNull,
        reason: 'Missing message for alert type $type',
      );
      expect(
        WebSocketService.eventMessage(type),
        DriverAlertEvents.messageFor(type),
      );
    }
  });

  test('all alert messages are non-empty', () {
    for (final entry in DriverAlertEvents.messages.entries) {
      expect(entry.value.trim(), isNotEmpty, reason: entry.key);
    }
  });
}
