import 'package:get_it/get_it.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'dart:io';
import '../storage/secure_storage.dart';
import '../network/dio_client.dart';
import 'location_service.dart';
import 'offline_sync_service.dart';
import 'websocket_service.dart';
import 'read_cache_service.dart';
import 'idle_timer_service.dart';
import 'connectivity_service.dart';
import 'tab_badge_service.dart';
import 'local_notification_service.dart';
import 'mobile_push_service.dart';
import 'driver_tracking_service.dart';
import 'background_sync_service.dart';
import 'session_revoked_notifier.dart';

final getIt = GetIt.instance;

Future<void> setupLocator({bool testMode = false}) async {
  if (testMode) {
    final dir = Directory.systemTemp.createTempSync('sezar_hive_test');
    Hive.init(dir.path);
  } else {
    await Hive.initFlutter();
  }
  getIt.registerLazySingleton<SecureStorage>(() => SecureStorage());
  getIt.registerLazySingleton<SessionRevokedNotifier>(() => SessionRevokedNotifier());
  getIt.registerLazySingleton<DioClient>(
    () => DioClient(getIt<SecureStorage>(), getIt<SessionRevokedNotifier>()),
  );
  getIt.registerLazySingleton<LocalNotificationService>(() => LocalNotificationService());
  getIt.registerLazySingleton<MobilePushService>(
    () => MobilePushService(getIt<LocalNotificationService>(), getIt<DioClient>()),
  );
  getIt.registerLazySingleton<WebSocketService>(
    () => WebSocketService(
      getIt<SecureStorage>(),
      dioClient: getIt<DioClient>(),
      localNotifications: getIt<LocalNotificationService>(),
    ),
  );
  getIt.registerLazySingleton<LocationService>(
    () => LocationService(getIt<DioClient>(), getIt<WebSocketService>()),
  );
  getIt.registerLazySingleton<OfflineQueueService>(() => OfflineQueueService(getIt<DioClient>()));
  getIt.registerLazySingleton<ConnectivityService>(() => ConnectivityService());
  getIt.registerLazySingleton<TabBadgeService>(() => TabBadgeService(getIt<DioClient>()));
  getIt.registerLazySingleton<DriverTrackingService>(
    () => DriverTrackingService(
      getIt<DioClient>(),
      getIt<WebSocketService>(),
      getIt<LocationService>(),
    ),
  );
  getIt.registerLazySingleton<IdleTimerService>(() => IdleTimerService());

  await OfflineQueueService.init();
  await ReadCacheService.init();
  if (!testMode) {
    await getIt<MobilePushService>().init();
    try {
      await BackgroundSyncService.init();
    } catch (_) {}
  }
}
