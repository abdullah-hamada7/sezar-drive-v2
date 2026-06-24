@echo off
echo =================================================================
echo Sezar Drive V2 - Production Android APK Build Script
echo =================================================================
echo.
echo Step 1: Cleaning project...
call flutter clean
if %ERRORLEVEL% neq 0 (
    echo Error cleaning project. Please check if Flutter SDK is in your PATH.
    goto error
)

echo.
echo Step 2: Fetching dependencies...
call flutter pub get
if %ERRORLEVEL% neq 0 (
    echo Error fetching dependencies.
    goto error
)

echo.
echo Step 3: Building Release APK...
echo Target Domain: https://abdullahamada.me/api/v1
call flutter build apk --release --dart-define=FLAVOR=prod
if %ERRORLEVEL% neq 0 (
    echo Error building release APK.
    goto error
)

echo.
echo =================================================================
echo Success! Release APK built successfully.
echo Output location: build\app\outputs\flutter-apk\app-release.apk
echo =================================================================
pause
exit /b 0

:error
echo.
echo =================================================================
echo Build failed. Please verify that:
echo 1. The Flutter SDK is installed and in your environment PATH variables.
echo 2. You have the Android SDK installed and configured.
echo =================================================================
pause
exit /b 1
