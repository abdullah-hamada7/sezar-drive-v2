// AppConfig — centralised environment-aware configuration.
//
// Mirrors the web frontend pattern:
//   VITE_API_URL=/api/v1  (relative, proxied via Caddy in production)
//
// For the mobile APK the domain is the canonical production host.
// Pass `--dart-define=FLAVOR=dev` at build time to switch to staging/local.
//
// Build commands:
//   Production APK:  flutter build apk --release
//   Staging APK:     flutter build apk --dart-define=FLAVOR=staging
//   Dev (run):       flutter run  --dart-define=FLAVOR=dev --dart-define=DEV_HOST=192.168.1.100

class AppConfig {
  AppConfig._(); // static-only class

  // ── Build-time flags ───────────────────────────────────────────────────────
  static const String _flavor = String.fromEnvironment(
    'FLAVOR',
    defaultValue: 'prod',
  );

  // For local development set DEV_HOST to your machine's LAN IP.
  static const String _devHost = String.fromEnvironment(
    'DEV_HOST',
    defaultValue: '10.0.2.2', // Android emulator loopback to host
  );

  // ── Resolved endpoints ─────────────────────────────────────────────────────
  static String get apiBaseUrl {
    switch (_flavor) {
      case 'dev':
        return 'http://$_devHost:3000/api/v1';
      case 'staging':
        return 'https://staging.abdullahamada.me/api/v1';
      case 'prod':
      default:
        return 'https://abdullahamada.me/api/v1';
    }
  }

  /// WebSocket base for real-time tracking (ws:// vs wss://)
  static String get wsBaseUrl {
    switch (_flavor) {
      case 'dev':
        return 'ws://$_devHost:3000';
      case 'staging':
        return 'wss://staging.abdullahamada.me';
      case 'prod':
      default:
        return 'wss://abdullahamada.me';
    }
  }

  // ── App metadata ───────────────────────────────────────────────────────────
  static const String appName = 'Sezar Driver';
  static const String appVersion = '1.0.0';
  static const String appBuildNumber = '1';

  // ── Network tunables ───────────────────────────────────────────────────────
  /// Milliseconds before a connection attempt is aborted.
  static const int connectTimeoutMs = 15000;

  /// Milliseconds before a response read is aborted.
  static const int receiveTimeoutMs = 30000;

  // ── S3 / media ─────────────────────────────────────────────────────────────
  /// The presigned-URL endpoint lives on the same API host.
  static String get s3PresignedUrl => '$apiBaseUrl/upload/presigned-url';

  // ── Feature flags ──────────────────────────────────────────────────────────
  static bool get isProduction => _flavor == 'prod';
  static bool get isStaging => _flavor == 'staging';
  static bool get isDev => _flavor == 'dev';
}
