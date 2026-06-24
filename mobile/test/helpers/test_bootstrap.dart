import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sezar_driver/src/core/network/dio_client.dart';
import 'package:sezar_driver/src/core/services/service_locator.dart';

/// Bootstraps GetIt + Hive for widget tests (mirrors production [setupLocator]).
Future<void> bootstrapWidgetTests() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  FlutterSecureStorage.setMockInitialValues({});
  if (!getIt.isRegistered<DioClient>()) {
    await setupLocator(testMode: true);
  }
}
