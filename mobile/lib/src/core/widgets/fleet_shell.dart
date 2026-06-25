import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/app_semantic_colors.dart';
import '../theme/app_theme.dart';
import 'sezar_brand_mark.dart';

/// Provides root drawer access to nested screen scaffolds.
class FleetShellScope extends InheritedWidget {
  const FleetShellScope({
    super.key,
    required this.openDrawer,
    required super.child,
  });

  final VoidCallback? openDrawer;

  static FleetShellScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<FleetShellScope>();
  }

  @override
  bool updateShouldNotify(FleetShellScope oldWidget) =>
      openDrawer != oldWidget.openDrawer;
}

/// Branded app bar used on primary task screens (home, trips, shift).
class FleetAppBar extends StatelessWidget implements PreferredSizeWidget {
  const FleetAppBar({
    super.key,
    required this.title,
    this.actions,
    this.bottom,
    this.leading,
    this.showBackButton = false,
  });

  final String title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final Widget? leading;
  final bool showBackButton;

  @override
  Size get preferredSize =>
      Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final semantic = context.semanticColors;
    final l10n = AppLocalizations.of(context);
    final shell = FleetShellScope.maybeOf(context);
    final showMenu = shell?.openDrawer != null;

    Widget? resolvedLeading = leading;
    if (resolvedLeading == null && showMenu) {
      resolvedLeading = IconButton(
        icon: const Icon(Icons.menu),
        tooltip: MaterialLocalizations.of(context).openAppDrawerTooltip,
        onPressed: shell!.openDrawer,
      );
    } else if (resolvedLeading == null &&
        showBackButton &&
        Navigator.canPop(context)) {
      resolvedLeading = const BackButton();
    }

    return AppBar(
      automaticallyImplyLeading: false,
      leading: resolvedLeading,
      title: Row(
        children: [
          SezarBrandMark(
            size: 28,
            semanticLabel: l10n.t('brand_name'),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  l10n.t('brand_name'),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: scheme.primary,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: actions,
      bottom: bottom,
      flexibleSpace: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: semantic.border)),
        ),
      ),
    );
  }
}

/// Drawer header with fleet brand lockup.
class FleetDrawerHeader extends StatelessWidget {
  const FleetDrawerHeader({
    super.key,
    required this.title,
    this.subtitle,
  });

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final semantic = context.semanticColors;
    final l10n = AppLocalizations.of(context);

    return DrawerHeader(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        border: Border(bottom: BorderSide(color: semantic.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SezarBrandMark(
            size: 44,
            semanticLabel: l10n.t('brand_name'),
          ),
          const Spacer(),
          Text(title, style: theme.textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(
            subtitle ?? l10n.t('driver_operations'),
            style: theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

/// Section label for dashboard groupings — no uppercase eyebrow spam.
class FleetSectionLabel extends StatelessWidget {
  const FleetSectionLabel({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge,
      ),
    );
  }
}
