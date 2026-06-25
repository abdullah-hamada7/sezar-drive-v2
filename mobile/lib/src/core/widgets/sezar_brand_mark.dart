import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../l10n/app_localizations.dart';

/// Official Sezar Drive fleet mark — matches admin PWA brand SVG.
class SezarBrandMark extends StatelessWidget {
  const SezarBrandMark({
    super.key,
    this.size = 48,
    this.semanticLabel,
  });

  final double size;
  final String? semanticLabel;

  static const _assetPath = 'assets/brand/sezar-drive-icon.svg';

  @override
  Widget build(BuildContext context) {
    final label = semanticLabel ?? AppLocalizations.of(context).t('brand_name');
    return Semantics(
      label: label,
      image: true,
      child: SvgPicture.asset(
        _assetPath,
        width: size,
        height: size,
        fit: BoxFit.contain,
      ),
    );
  }
}

/// Wordmark row for login, drawer, and privacy overlay.
class SezarBrandLockup extends StatelessWidget {
  const SezarBrandLockup({
    super.key,
    this.markSize = 56,
    this.showSubtitle = true,
    this.subtitle,
    this.alignment = CrossAxisAlignment.center,
  });

  final double markSize;
  final bool showSubtitle;
  final String? subtitle;
  final CrossAxisAlignment alignment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.color;
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: alignment,
      children: [
        SezarBrandMark(size: markSize),
        const SizedBox(height: 16),
        Text(
          l10n.t('brand_name'),
          style: theme.textTheme.headlineMedium?.copyWith(
            fontSize: 26,
            letterSpacing: -0.02,
          ),
        ),
        if (showSubtitle) ...[
          const SizedBox(height: 6),
          Text(
            subtitle ?? l10n.t('driver_operations'),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: muted,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}
