# Setup Android SDK without Android Studio
# This script downloads commandlinetools, extracts them, and downloads the required compiler platforms & build tools.

$ErrorActionPreference = "Stop"

$sdkRoot = "D:\Android\Sdk"
$zipPath = "$sdkRoot\cmdline-tools.zip"
$downloadUrl = "https://dl.google.com/android/repository/commandlinetools-win-14742923_latest.zip"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Sezar Drive V2 - Android SDK CLI Downloader & Setup" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# Create directories
if (-not (Test-Path $sdkRoot)) {
    Write-Host "Creating SDK directory at $sdkRoot..." -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null
}

# Download commandlinetools
Write-Host "Downloading Command Line Tools from Google..." -ForegroundColor Green
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UserAgent "Mozilla/5.0"

# Extract cmdline-tools
Write-Host "Extracting Command Line Tools..." -ForegroundColor Green
$tempExtract = "$sdkRoot\temp_extract"
if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract }
Expand-Archive -Path $zipPath -DestinationPath $tempExtract

# Move to the correct folder structure (cmdline-tools\latest)
$latestPath = "$sdkRoot\cmdline-tools\latest"
if (Test-Path $latestPath) {
    Write-Host "Cleaning existing cmdline-tools\latest directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $latestPath
}
New-Item -ItemType Directory -Force -Path "$sdkRoot\cmdline-tools" | Out-Null

Write-Host "Structuring SDK directory..." -ForegroundColor Green
Move-Item -Path "$tempExtract\cmdline-tools" -Destination $latestPath

# Clean up zip & temp folder
Remove-Item -Force $zipPath
Remove-Item -Recurse -Force $tempExtract

# Verify sdkmanager exists
$sdkManager = "$latestPath\bin\sdkmanager.bat"
if (-not (Test-Path $sdkManager)) {
    Write-Host "Error: sdkmanager.bat was not found at $sdkManager" -ForegroundColor Red
    exit 1
}

# Run sdkmanager to install platforms & build tools
Write-Host "Downloading platforms, build-tools, and platform-tools via sdkmanager..." -ForegroundColor Green
# We pass "y" to accept packages silently
$installCmd = "$sdkManager --sdk_root=$sdkRoot `"platform-tools`" `"platforms;android-34`" `"build-tools;34.0.0`""
Write-Host "Running: $installCmd" -ForegroundColor Gray
echo y | & $sdkManager --sdk_root=$sdkRoot "platform-tools" "platforms;android-34" "build-tools;34.0.0"

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "SDK Setup Complete!" -ForegroundColor Green
Write-Host "Your Android SDK path: $sdkRoot" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To compile your APK now, run the following commands in your terminal:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  `$env:ANDROID_HOME=`"$sdkRoot`"" -ForegroundColor Cyan
Write-Host "  & `"D:\flutter_windows_3.44.2-stable\flutter\bin\flutter.bat`" doctor --android-licenses" -ForegroundColor Cyan
Write-Host "  & `"D:\flutter_windows_3.44.2-stable\flutter\bin\flutter.bat`" build apk --release --dart-define=FLAVOR=prod" -ForegroundColor Cyan
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
