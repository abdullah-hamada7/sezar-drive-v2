# Mobile Driver App — Task Tracker

All tasks T01–T27 implemented unless noted.

---

## Status

| Range | Status |
|-------|--------|
| T01–T17 | Done |
| T18 | Done — shell + main screens localized (EN/AR) |
| T19 | Done — light/dark theme |
| T20 | Done — workmanager background sync (lightweight isolate) |
| T21 | Done — FCM mobile + backend (`device_push_tokens`, `fcm.service.js`) |
| T22 | Manual — run `flutter create --platforms=ios .` when Flutter available |
| T23–T27 | Done |

---

## FCM setup

See [docs/FCM_SETUP.md](docs/FCM_SETUP.md).

**Backend:** `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env`

**Mobile:** Copy `android/app/google-services.json.example` → `google-services.json` or run `flutterfire configure`

FCM is **free** on Firebase Spark plan.

---

## Progress log (latest)

| Task | Date | Notes |
|------|------|-------|
| T16 | 2026-06-23 | RealtimeGuard reset on WS reconnect |
| T18 | 2026-06-23 | Expanded l10n; login, home, trips, expenses, shift, drawer |
| T20 | 2026-06-23 | Background isolate uses Hive + DioClient only (no full getIt) |
| T21 | 2026-06-23 | firebase_messaging + register/unregister API + unified push send |
| T26 | 2026-06-23 | apiError in all cubits; locale from AppLocale |
| T08 | 2026-06-23 | AuthPasswordChanged + home listener for password feedback |
