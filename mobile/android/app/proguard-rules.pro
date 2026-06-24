# ═══════════════════════════════════════════════════════════════
# Sezar Driver — ProGuard / R8 Rules
# ═══════════════════════════════════════════════════════════════

# Flutter engine — keep all Flutter classes
-keep class io.flutter.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }
-dontwarn io.flutter.embedding.**

# Dart VM JNI entry points
-keep class io.flutter.app.** { *; }
-keep class io.flutter.view.** { *; }

# ── Kotlin / Coroutines ─────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.coroutines.**

# ── Dio / OkHttp / Retrofit ─────────────────────────────────────
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ── Hive (local database) ───────────────────────────────────────
-keep class com.hivedb.** { *; }
-keep class hive.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# ── Flutter Secure Storage ──────────────────────────────────────
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# ── WorkManager ─────────────────────────────────────────────────
-keep class androidx.work.** { *; }
-keep class be.tramckrijte.workmanager.** { *; }

# ── Geolocator ──────────────────────────────────────────────────
-keep class com.baseflow.geolocator.** { *; }

# ── Camera / Mobile Scanner ─────────────────────────────────────
-keep class io.github.edufolly.fluttermobilescanner.** { *; }
-keep class dev.steenbakker.mobile_scanner.** { *; }
-keep class io.flutter.plugins.camera.** { *; }

# ── Image Picker ────────────────────────────────────────────────
-keep class io.flutter.plugins.imagepicker.** { *; }

# ── Permission Handler ──────────────────────────────────────────
-keep class com.baseflow.permissionhandler.** { *; }

# ── Connectivity Plus ───────────────────────────────────────────
-keep class dev.fluttercommunity.plus.connectivity.** { *; }

# ── Firebase / FCM ───────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**

# ── Google Fonts (downloaded fonts may use reflection) ──────────

# ── JSON / Serialization ────────────────────────────────────────
# Keep all model classes that are serialized/deserialized
-keepclassmembers class * {
    @com.google.gson.annotations.Expose <fields>;
}
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ── General Android ─────────────────────────────────────────────
-dontwarn android.support.**
-dontwarn androidx.**
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# Keep enum classes intact (used by platform channels)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable implementations
-keepnames class * implements java.io.Serializable
