import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase options — replace via `flutterfire configure` or dart-define flags.
///
/// Example:
/// flutter run --dart-define=FIREBASE_API_KEY=... --dart-define=FIREBASE_APP_ID=...
class DefaultFirebaseOptions {
  static bool get isConfigured => _apiKey.isNotEmpty && _appId.isNotEmpty;

  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY', defaultValue: '');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID', defaultValue: '');
  static const _messagingSenderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID', defaultValue: '');
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID', defaultValue: '');
  static const _storageBucket = String.fromEnvironment('FIREBASE_STORAGE_BUCKET', defaultValue: '');
  static const _iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID', defaultValue: 'com.sezardrive.app.sezarDriver');

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('FCM is not configured for web in this app.');
    }
    if (!isConfigured) {
      throw UnsupportedError(
        'Firebase is not configured. Run `flutterfire configure` or pass FIREBASE_* dart-defines.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('FCM is not supported on this platform.');
    }
  }

  static FirebaseOptions get android => FirebaseOptions(
    apiKey: _apiKey,
    appId: _appId,
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    storageBucket: _storageBucket.isEmpty ? null : _storageBucket,
  );

  static FirebaseOptions get ios => FirebaseOptions(
    apiKey: _apiKey,
    appId: _appId,
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    storageBucket: _storageBucket.isEmpty ? null : _storageBucket,
    iosBundleId: _iosBundleId,
  );
}
