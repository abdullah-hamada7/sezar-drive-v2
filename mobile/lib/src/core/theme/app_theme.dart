import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_semantic_colors.dart';

/// Sezar Drive field palette — zinc ops surfaces + fleet signal red (brand mark).
class AppTheme {
  AppTheme._();

  static const Color primaryColor = Color(0xFFEF4444);
  static const Color secondaryColor = Color(0xFFDC2626);
  /// Deeper red for filled buttons — white label meets WCAG AA (≥4.5:1).
  static const Color buttonPrimaryColor = Color(0xFFB91C1C);
  static const Color backgroundColor = Color(0xFF09090B);
  static const Color cardColor = Color(0xFF131316);
  static const Color surfaceElevated = Color(0xFF1C1C21);
  static const Color textColor = Color(0xFFFAFAFA);
  static const Color textMutedColor = Color(0xFFA1A1AA);
  static const Color successColor = Color(0xFF22C55E);
  static const Color warningColor = Color(0xFFF59E0B);
  static const Color dangerColor = Color(0xFFEF4444);

  static const Color lightBackground = Color(0xFFF4F4F5);
  static const Color lightInk = Color(0xFF18181B);

  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;

  static ThemeData get darkTheme => _buildTheme(
        brightness: Brightness.dark,
        background: backgroundColor,
        surface: cardColor,
        surfaceVariant: surfaceElevated,
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
        surfaceVariant: const Color(0xFFF4F4F5),
        onSurface: lightInk,
        onPrimary: Colors.white,
        inputFill: AppSemanticColors.light.inputFill,
        border: AppSemanticColors.light.border,
        semantic: AppSemanticColors.light,
      );

  static TextTheme _textTheme(Color onSurface, Color muted) {
    final base = GoogleFonts.plusJakartaSansTextTheme();
    return base.copyWith(
      headlineLarge: base.headlineLarge?.copyWith(
        color: onSurface,
        fontSize: 24,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.02,
        height: 1.2,
      ),
      headlineMedium: base.headlineMedium?.copyWith(
        color: onSurface,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.01,
        height: 1.25,
      ),
      titleMedium: base.titleMedium?.copyWith(
        color: onSurface,
        fontSize: 16,
        fontWeight: FontWeight.w600,
        height: 1.35,
      ),
      bodyLarge: base.bodyLarge?.copyWith(
        color: onSurface,
        fontSize: 16,
        height: 1.5,
      ),
      bodyMedium: base.bodyMedium?.copyWith(
        color: muted,
        fontSize: 14,
        height: 1.45,
      ),
      labelLarge: base.labelLarge?.copyWith(
        color: onSurface,
        fontSize: 14,
        fontWeight: FontWeight.w600,
        height: 1.35,
      ),
      labelSmall: base.labelSmall?.copyWith(
        color: muted,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.4,
        height: 1.3,
      ),
    );
  }

  static ThemeData _buildTheme({
    required Brightness brightness,
    required Color background,
    required Color surface,
    required Color surfaceVariant,
    required Color onSurface,
    required Color onPrimary,
    required Color inputFill,
    required Color border,
    required AppSemanticColors semantic,
  }) {
    final muted = semantic.muted;

    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: primaryColor,
      onPrimary: onPrimary,
      secondary: secondaryColor,
      onSecondary: onPrimary,
      error: dangerColor,
      onError: onPrimary,
      surface: surface,
      onSurface: onSurface,
      surfaceContainerHighest: surfaceVariant,
    );

    return ThemeData(
      brightness: brightness,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: background,
      cardColor: surface,
      dividerColor: border,
      useMaterial3: true,
      colorScheme: colorScheme,
      extensions: [semantic],
      textTheme: _textTheme(onSurface, muted),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: 16,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: onSurface,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.01,
        ),
        iconTheme: IconThemeData(color: onSurface),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: BorderSide(color: border),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        elevation: 0,
        height: 68,
        indicatorColor: primaryColor.withValues(alpha: 0.14),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            size: 24,
            color: selected ? primaryColor : muted,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? primaryColor : muted,
          );
        }),
      ),
      drawerTheme: DrawerThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(right: Radius.circular(radiusLg)),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: buttonPrimaryColor,
          foregroundColor: onPrimary,
          elevation: 0,
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: onSurface,
          side: BorderSide(color: border),
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryColor,
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: inputFill,
        hintStyle: GoogleFonts.plusJakartaSans(color: muted, fontSize: 14),
        labelStyle: GoogleFonts.plusJakartaSans(color: muted, fontSize: 14),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: dangerColor),
        ),
      ),
      bannerTheme: MaterialBannerThemeData(
        contentTextStyle: GoogleFonts.plusJakartaSans(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
      dividerTheme: DividerThemeData(color: border, thickness: 1, space: 1),
      listTileTheme: ListTileThemeData(
        iconColor: muted,
        textColor: onSurface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
    );
  }
}
