import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'src/core/services/local_notification_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (DefaultFirebaseOptions.isConfigured) {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } else {
    await Firebase.initializeApp();
  }
  final local = LocalNotificationService();
  await local.init();
  final title = message.notification?.title ?? 'Sezar Driver';
  final body = message.notification?.body ?? '';
  if (body.isNotEmpty) {
    await local.show(title: title, body: body);
  }
}
