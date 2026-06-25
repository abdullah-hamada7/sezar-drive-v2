# Android UI Journey Tests — Sezar Driver

XML journey specs for device/emulator verification using ADB, following the **android-ui-journey-testing** workflow.

## Prerequisites

- Android device or emulator connected (`adb devices`)
- Debug or release APK installed: `com.sezardrive.driver` (or your app id)
- For authenticated journeys: driver already logged in, or extend the XML with login steps

## Run a journey

```bash
# From repo root
python3 mobile/test/journeys/run_journey.py mobile/test/journeys/driver_login_smoke.xml
```

Exit code `0` = all steps passed. Output is JSON with per-step `PASSED` / `FAILED` / `SKIPPED`.

## Available journeys

| File | Purpose |
|------|---------|
| `driver_login_smoke.xml` | App launch → sign-in screen visible |
| `shift_inspection_navigation.xml` | Shift tab → start shift → open inspection → back without losing shift context |
| `driver_notifications_drawer.xml` | Drawer → notifications loads without error state |

## Supported action syntax

| Action | Example |
|--------|---------|
| Wait | `Wait 2` |
| Tap by visible text | `Tap "Sign in"` |
| Type into focused field | `Type "driver@example.com"` |
| Assert visible | `Verify that "Dashboard" is visible` |
| Assert absent | `Verify that "Could not load notifications" is not visible` |
| Back / menu | `Press back`, `Press menu` |

## Unit tests (no device)

```bash
cd mobile && flutter test test/driver_alert_events_test.dart
```

## android-dev checklist (alerts)

- `POST_NOTIFICATIONS` in manifest + runtime request (Android 13+)
- FCM channel `sezar_driver_events` matches backend FCM config
- `singleTop` launch mode preserves inspection state after camera
- Shared `DriverAlertEvents` constants for WebSocket + local notifications
