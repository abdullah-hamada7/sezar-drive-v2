# Firebase Cloud Messaging (FCM) Setup

FCM is **free** on Firebase Spark plan (no per-message charge).

## 1. Firebase Console

1. Create a project at https://console.firebase.google.com
2. Add **Android** app with package `com.sezardrive.app.sezar_driver`
3. Download `google-services.json` → `mobile/android/app/google-services.json`
4. (Optional iOS) Add iOS app, download `GoogleService-Info.plist` → `mobile/ios/Runner/`
5. **Project Settings → Service accounts → Generate new private key** (JSON)

## 2. Backend

Add to `backend/.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
```

Place your Firebase service account JSON at `backend/secrets/firebase-service-account.json` (gitignored).

Run migration:

```bash
cd backend
npm install
npx prisma migrate deploy
```

API endpoints:

- `POST /api/v1/push/register-device` — body: `{ "token": "...", "platform": "android" }`
- `POST /api/v1/push/unregister-device` — body: `{ "token": "..." }`

## 3. Flutter mobile

```bash
cd mobile
flutter pub get
cp android/app/google-services.json.example android/app/google-services.json
# Replace google-services.json with your real file from Firebase Console
```

**Option A — FlutterFire CLI (recommended):**

```bash
dart pub global activate flutterfire_cli
flutterfire configure
```

**Option B — dart-define flags** (see `lib/firebase_options.dart`):

```bash
flutter run \
  --dart-define=FIREBASE_API_KEY=your_key \
  --dart-define=FIREBASE_APP_ID=your_app_id \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=your_sender_id \
  --dart-define=FIREBASE_PROJECT_ID=your_project_id
```

## 4. Test

1. Login on a physical Android device
2. Confirm token saved: `SELECT * FROM device_push_tokens;`
3. Assign a trip from admin → push should arrive with app killed
4. Logout → token removed from DB

## 5. iOS (optional)

```bash
cd mobile
flutter create --platforms=ios .
```

Enable Push Notifications + Background Modes in Xcode. Upload APNs key in Firebase Console → Cloud Messaging.
