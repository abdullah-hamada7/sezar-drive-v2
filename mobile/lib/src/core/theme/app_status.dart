import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/app_semantic_colors.dart';
import '../theme/app_theme.dart';

class AppStatus {
  AppStatus._();

  static Color tripStatus(BuildContext context, String status) {
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;
    switch (status) {
      case 'ASSIGNED':
        return scheme.primary;
      case 'ACCEPTED':
        return semantic.warning;
      case 'IN_PROGRESS':
        return semantic.warning;
      case 'COMPLETED':
        return semantic.success;
      case 'CANCELLED':
        return semantic.danger;
      default:
        return semantic.muted;
    }
  }

  static String tripStatusLabel(AppLocalizations l10n, String status) {
    switch (status) {
      case 'ASSIGNED':
        return l10n.t('status_assigned');
      case 'ACCEPTED':
        return l10n.t('status_accepted');
      case 'IN_PROGRESS':
        return l10n.t('status_in_progress');
      case 'COMPLETED':
        return l10n.t('status_completed');
      case 'CANCELLED':
        return l10n.t('status_cancelled');
      default:
        return status;
    }
  }

  static String paymentLabel(AppLocalizations l10n, String method) {
    switch (method.toUpperCase()) {
      case 'CASH':
        return l10n.t('cash');
      case 'E_WALLET':
        return l10n.t('ewallet');
      case 'E_PAYMENT':
        return l10n.t('epayment');
      default:
        return method;
    }
  }

  static Color expenseStatusColor(BuildContext context, String status) {
    final semantic = context.semanticColors;
    switch (status.toLowerCase()) {
      case 'approved':
        return semantic.success;
      case 'rejected':
        return semantic.danger;
      default:
        return semantic.warning;
    }
  }

  static Color offlineQueueTypeColor(BuildContext context, String type) {
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;
    if (type.contains('inspection')) return scheme.primary;
    if (type.contains('expense')) return semantic.warning;
    if (type.contains('damage')) return semantic.danger;
    return semantic.muted;
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final semantic = context.semanticColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: semantic.statusBackground(color),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12),
      ),
    );
  }
}

class SemanticBanner extends StatelessWidget {
  const SemanticBanner({
    super.key,
    required this.message,
    required this.icon,
    required this.background,
    this.foreground = Colors.white,
  });

  final String message;
  final IconData icon;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      color: background,
      child: ListTile(
        leading: Icon(icon, color: foreground),
        title: Text(message, style: TextStyle(color: foreground, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

ButtonStyle successButtonStyle(BuildContext context) {
  final semantic = context.semanticColors;
  return ElevatedButton.styleFrom(backgroundColor: semantic.success, foregroundColor: Colors.white);
}

ButtonStyle dangerButtonStyle(BuildContext context) {
  final semantic = context.semanticColors;
  return ElevatedButton.styleFrom(backgroundColor: semantic.danger, foregroundColor: Colors.white);
}

ButtonStyle warningButtonStyle(BuildContext context) {
  final semantic = context.semanticColors;
  return ElevatedButton.styleFrom(
    backgroundColor: semantic.warning,
    foregroundColor: AppTheme.backgroundColor,
  );
}

ButtonStyle primaryButtonStyle(BuildContext context) {
  return ElevatedButton.styleFrom(
    backgroundColor: Theme.of(context).colorScheme.primary,
    foregroundColor: Colors.white,
  );
}
