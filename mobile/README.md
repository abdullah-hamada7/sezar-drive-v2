# Sezar Driver — Flutter Mobile App

**Version:** 1.0.0  
**Package:** `sezar_driver`  
**Platform:** Android (primary), iOS (supported)  
**Audience:** Fleet drivers in the field  

Native driver client for the Sezar Drive platform. Drivers authenticate, complete shift verification (face match, QR scan, six-photo inspection), manage trips, log expenses, report damage, view traffic violations, and receive real-time alerts.

Product & UX principles: [PRODUCT.md](PRODUCT.md) · Design tokens: [DESIGN.md](DESIGN.md)

---

## Architecture Overview

```text
mobile/lib/
├── main.dart                          # App entry, navigation shell, Bloc providers
├── src/
│   ├── core/
│   │   ├── config/app_config.dart     # API URLs, flavors (dev/staging/prod)
│   │   ├── network/dio_client.dart    # JWT, refresh, cache interceptor
│   │   ├── services/
│   │   │   ├── driver_alert_events.dart   # Alert type constants (sync with backend)
│   │   │   ├── websocket_service.dart     # Real-time events
│   │   │   ├── mobile_push_service.dart   # FCM + Android 13 notification permission
│   │   │   └── local_notification_service.dart
│   │   └── domain/                    # Shared models
│   └── features/
│       ├── auth/          # Login, device verification, password change
│       ├── shift/         # Shift verification flow
│       ├── inspection/    # Checklist + 6-photo wizard (draft persistence)
│       ├── trip/          # Trip lifecycle + route map
│       ├── notifications/ # In-app notification inbox
│       └── …              # expenses, damage, violations, home
```

**State management:** `flutter_bloc` + `get_it` service locator  
**Offline:** Hive read cache + offline action queue  

---

## Requirements

- Flutter SDK ≥ 3.10 ([install](https://docs.flutter.dev/get-started/install))
- Android SDK (API 21+) for APK builds
- Firebase project for push (see [docs/FCM_SETUP.md](docs/FCM_SETUP.md))

---

## Configuration (Flavors)

| Flavor | API base | Command |
|--------|----------|---------|
| **prod** (default) | `https://abdullahamada.me/api/v1` | `flutter build apk --release` |
| **staging** | `https://staging.abdullahamada.me/api/v1` | `--dart-define=FLAVOR=staging` |
| **dev** | `http://<host>:3000/api/v1` | `--dart-define=FLAVOR=dev --dart-define=DEV_HOST=10.0.2.2` |

`10.0.2.2` is the Android emulator loopback to the host machine.

---

## Getting Started

```bash
cd mobile
flutter pub get
flutter run --dart-define=FLAVOR=dev --dart-define=DEV_HOST=10.0.2.2
```

### Production APK

```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

---

## Key Driver Flows

### Shift start → inspection

During shift verification (`PendingVerification`), tapping **Open inspection** pushes a **full-screen inspection route** (not a tab switch) so the camera and WebSocket refresh do not lose wizard progress.

- Six photos upload to **S3** via `POST /inspections/:id/photos`
- Draft state persists locally (Hive) across app backgrounding
- See `lib/src/features/inspection/`

### Notifications & alerts

Three channels: FCM push, WebSocket (foreground), in-app inbox.

- Constants: `lib/src/core/services/driver_alert_events.dart`
- Must stay aligned with backend `driverAlert.service.js`
- Full reference: [../docs/09-driver-alerts-and-notifications.md](../docs/09-driver-alerts-and-notifications.md)

---

## Testing

### Unit / widget tests

```bash
flutter analyze
flutter test
flutter test test/driver_alert_events_test.dart
```

### Android UI journeys (ADB)

XML-specified user journeys with JSON reports. Requires a connected device/emulator and installed APK.

```bash
python3 test/journeys/run_journey.py test/journeys/driver_login_smoke.xml
```

See [test/journeys/README.md](test/journeys/README.md).

---

## Android Permissions

Declared in `android/app/src/main/AndroidManifest.xml`:

- `INTERNET`, `CAMERA`, location, storage/media, `POST_NOTIFICATIONS`
- `launchMode="singleTop"` on MainActivity — preserves state when returning from camera

Runtime notification permission (Android 13+) is requested in `MobilePushService`.

---

## Related Documentation

| Doc | Topic |
|-----|-------|
| [docs/FCM_SETUP.md](docs/FCM_SETUP.md) | Firebase & backend FCM config |
| [PRODUCT.md](PRODUCT.md) | Product purpose & UX principles |
| [DESIGN.md](DESIGN.md) | Visual design system |
| [../docs/09-driver-alerts-and-notifications.md](../docs/09-driver-alerts-and-notifications.md) | Alert architecture |
| [../docs/06-api-specification.md](../docs/06-api-specification.md) | REST API |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Replaced Flutter template README; documented flavors, alerts, inspection, journeys |
