import 'package:flutter/material.dart';

import 'app_theme.dart';

@immutable
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  const AppSemanticColors({
    required this.success,
    required this.warning,
    required this.danger,
    required this.border,
    required this.inputFill,
    required this.muted,
  });

  final Color success;
  final Color warning;
  final Color danger;
  final Color border;
  final Color inputFill;
  final Color muted;

  static const AppSemanticColors dark = AppSemanticColors(
    success: AppTheme.successColor,
    warning: AppTheme.warningColor,
    danger: AppTheme.dangerColor,
    border: Color(0xFF2E2E36),
    inputFill: AppTheme.backgroundColor,
    muted: AppTheme.textMutedColor,
  );

  static const AppSemanticColors light = AppSemanticColors(
    success: AppTheme.successColor,
    warning: AppTheme.warningColor,
    danger: AppTheme.dangerColor,
    border: Color(0xFFD4D4D8),
    inputFill: Color(0xFFF4F4F5),
    muted: Color(0xFF71717A),
  );

  Color statusBackground(Color color, {double opacity = 0.18}) {
    return color.withValues(alpha: opacity);
  }

  @override
  AppSemanticColors copyWith({
    Color? success,
    Color? warning,
    Color? danger,
    Color? border,
    Color? inputFill,
    Color? muted,
  }) {
    return AppSemanticColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      border: border ?? this.border,
      inputFill: inputFill ?? this.inputFill,
      muted: muted ?? this.muted,
    );
  }

  @override
  AppSemanticColors lerp(ThemeExtension<AppSemanticColors>? other, double t) {
    if (other is! AppSemanticColors) return this;
    return AppSemanticColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      border: Color.lerp(border, other.border, t)!,
      inputFill: Color.lerp(inputFill, other.inputFill, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
    );
  }
}

extension AppSemanticColorsContext on BuildContext {
  AppSemanticColors get semanticColors =>
      Theme.of(this).extension<AppSemanticColors>() ?? AppSemanticColors.dark;
}
