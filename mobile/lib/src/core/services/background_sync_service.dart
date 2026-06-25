import 'package:flutter/widgets.dart';

import 'package:hive_flutter/hive_flutter.dart';

import 'package:workmanager/workmanager.dart';

import '../storage/secure_storage.dart';
import '../network/dio_client.dart';
import 'offline_sync_service.dart';
import 'session_revoked_notifier.dart';

const backgroundSyncTaskName = 'sezarOfflineSync';

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task == backgroundSyncTaskName) {
      WidgetsFlutterBinding.ensureInitialized();
      await Hive.initFlutter();
      await OfflineQueueService.init();
      final storage = SecureStorage();
      final notifier = SessionRevokedNotifier();
      final client = DioClient(storage, notifier);

      final queue = OfflineQueueService(client);

      await queue.syncAll();

    }

    return Future.value(true);

  });

}



class BackgroundSyncService {

  static Future<void> init() async {

    await Workmanager().initialize(callbackDispatcher);

    await Workmanager().registerPeriodicTask(

      backgroundSyncTaskName,

      backgroundSyncTaskName,

      frequency: const Duration(minutes: 15),

      constraints: Constraints(networkType: NetworkType.connected),

    );

  }

}

