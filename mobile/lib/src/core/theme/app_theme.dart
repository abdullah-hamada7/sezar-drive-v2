import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_semantic_colors.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF6366F1);
  static const Color secondaryColor = Color(0xFF4F46E5);
  static const Color backgroundColor = Color(0xFF0F172A);
  static const Color cardColor = Color(0xFF1E293B);
  static const Color textColor = Color(0xFFF8FAFC);
  static const Color textMutedColor = Color(0xFF94A3B8);
  static const Color successColor = Color(0xFF10B981);
  static const Color warningColor = Color(0xFFF59E0B);
  static const Color dangerColor = Color(0xFFEF4444);

  static const Color lightBackground = Color(0xFFF8FAFC);
  static const Color lightInk = Color(0xFF0F172A);

  static ThemeData get darkTheme => _buildTheme(
        brightness: Brightness.dark,
        background: backgroundColor,
        surface: cardColor,
        onSurface: textColor,
        onPrimary: Colors.white,
        inputFill: backgroundColor,
        border: AppSemanticColors.dark.border,
        semantic: AppSemanticColors.dark,
      );

  static ThemeData get lightTheme => _buildTheme(
        brightness: Brightness.light,
        background: lightBackground,
        surface: Colors.white,
        onSurface: lightInk,
        onPrimary: Colors.white,
        inputFill: AppSemanticColors.light.inputFill,
        border: AppSemanticColors.light.border,
        semantic: AppSemanticColors.light,
      );

  static ThemeData _buildTheme({
    required Brightness brightness,
    required Color background,
    required Color surface,
    required Color onSurface,
    required Color onPrimary,
    required Color inputFill,
    required Color border,
    required AppSemanticColors semantic,
  }) {
    final isDark = brightness == Brightness.dark;
    final muted = semantic.muted;

    final colorScheme = isDark
        ? const ColorScheme.dark(
            primary: primaryColor,
            secondary: secondaryColor,
            surface: cardColor,
            error: dangerColor,
            onPrimary: Colors.white,
            onSecondary: Colors.white,
            onSurface: textColor,
          )
        : const ColorScheme.light(
            primary: primaryColor,
            secondary: secondaryColor,
            surface: Colors.white,
            error: dangerColor,
            onPrimary: Colors.white,
            onSurface: lightInk,
          );

    return ThemeData(
      brightness: brightness,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: background,
      cardColor: surface,
      useMaterial3: true,
      colorScheme: colorScheme,
      extensions: [semantic],
      textTheme: GoogleFonts.interTextTheme(
        TextTheme(
          headlineLarge: TextStyle(color: onSurface, fontSize: 24, fontWeight: FontWeight.bold),
          headlineMedium: TextStyle(color: onSurface, fontSize: 20, fontWeight: FontWeight.bold),
          bodyLarge: TextStyle(color: onSurface, fontSize: 16),
          bodyMedium: TextStyle(color: muted, fontSize: 14),
          labelLarge: TextStyle(color: onSurface, fontSize: 14, fontWeight: FontWeight.bold),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? background : Colors.white,
        foregroundColor: onSurface,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(color: onSurface, fontSize: 18, fontWeight: FontWeight.bold),
        iconTheme: IconThemeData(color: onSurface),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: border, width: 1),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: primaryColor.withValues(alpha: 0.18),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? primaryColor : muted,
          );
        }),
      ),
      drawerTheme: DrawerThemeData(
        backgroundColor: surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(right: Radius.circular(16)),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: onPrimary,
          elevation: 0,
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: onSurface,
          side: BorderSide(color: border),
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: inputFill,
        hintStyle: TextStyle(color: muted, fontSize: 14),
        labelStyle: TextStyle(color: muted, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: dangerColor),
        ),
      ),
      bannerTheme: MaterialBannerThemeData(
        contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
      ),
    );
  }
}
