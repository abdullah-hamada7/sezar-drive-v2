import 'package:flutter/material.dart';

import '../theme/app_semantic_colors.dart';
import '../theme/app_theme.dart';

enum AppFeedbackType { success, error, warning, info }

class AppFeedback {
  AppFeedback._();

  static OverlayEntry? _entry;

  static void show(
    BuildContext context, {
    required String message,
    AppFeedbackType type = AppFeedbackType.info,
    Duration duration = const Duration(seconds: 5),
  }) {
    hide();

    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;
    final (background, foreground, icon) = _palette(type, semantic, scheme);

    _entry = OverlayEntry(
      builder: (ctx) => _TopToast(
        message: message,
        background: background,
        foreground: foreground,
        icon: icon,
        onDismiss: hide,
      ),
    );

    overlay.insert(_entry!);
    Future.delayed(duration, hide);
  }

  static void hide() {
    _entry?.remove();
    _entry = null;
  }

  static (Color, Color, IconData) _palette(
    AppFeedbackType type,
    AppSemanticColors semantic,
    ColorScheme scheme,
  ) {
    switch (type) {
      case AppFeedbackType.success:
        return (semantic.success, Colors.white, Icons.check_circle_outline);
      case AppFeedbackType.error:
        return (semantic.danger, Colors.white, Icons.error_outline);
      case AppFeedbackType.warning:
        return (semantic.warning, AppTheme.backgroundColor, Icons.warning_amber_outlined);
      case AppFeedbackType.info:
        return (scheme.surfaceContainerHighest, scheme.onSurface, Icons.info_outline);
    }
  }
}

class _TopToast extends StatelessWidget {
  const _TopToast({
    required this.message,
    required this.background,
    required this.foreground,
    required this.icon,
    required this.onDismiss,
  });

  final String message;
  final Color background;
  final Color foreground;
  final IconData icon;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);

    return PositionedDirectional(
      top: padding.top + 12,
      end: 16,
      child: Material(
        color: Colors.transparent,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width - 32),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [
                BoxShadow(color: Color(0x66000000), blurRadius: 8, offset: Offset(0, 4)),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, color: foreground, size: 20),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      message,
                      style: TextStyle(color: foreground, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: onDismiss,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Icon(Icons.close, color: foreground, size: 18),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
