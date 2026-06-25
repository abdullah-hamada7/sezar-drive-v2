import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../../core/widgets/list_loading_skeleton.dart';
import '../../../core/widgets/fleet_shell.dart';
import '../cubit/notification_cubit.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    final cubit = context.read<NotificationCubit>();
    await cubit.fetchNotifications();
    if (!mounted) return;
    try {
      await cubit.markAllAsRead();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: FleetAppBar(
        title: l10n.t('notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.mark_email_read_outlined),
            onPressed: () => context.read<NotificationCubit>().markAllAsRead(),
            tooltip: l10n.t('mark_all_read'),
          ),
        ],
      ),
      body: BlocBuilder<NotificationCubit, NotificationState>(
        builder: (context, state) {
          if (state is NotificationLoading || state is NotificationInitial) {
            return const ListLoadingSkeleton(itemCount: 4, itemHeight: 72);
          }

          if (state is NotificationLoaded) {
            final notifications = state.notifications;
            if (notifications.isEmpty) {
              return EmptyStatePanel(
                icon: Icons.notifications_off_outlined,
                title: l10n.t('notifications_empty'),
                message: state.isStale
                    ? l10n.t('cached_offline')
                    : l10n.t('notifications_empty_hint'),
              );
            }

            return Column(
              children: [
                if (state.isStale)
                  MaterialBanner(
                    content: Text(l10n.t('cached_offline')),
                    leading: const Icon(Icons.cloud_off_outlined),
                    actions: [
                      TextButton(
                        onPressed: _loadNotifications,
                        child: Text(l10n.t('retry')),
                      ),
                    ],
                  ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: notifications.length,
                    itemBuilder: (context, index) {
                      final notif = notifications[index];
                      final unread = !notif.isRead;
                      return Card(
                        color: unread
                            ? semantic.statusBackground(scheme.primary,
                                opacity: 0.08)
                            : null,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: unread
                                ? scheme.primary.withValues(alpha: 0.4)
                                : semantic.border,
                          ),
                        ),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor:
                                unread ? scheme.primary : semantic.muted,
                            child: const Icon(Icons.notifications_active,
                                color: Colors.white, size: 20),
                          ),
                          title: Text(
                            notif.title,
                            style: TextStyle(
                              fontWeight:
                                  unread ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Text(notif.body),
                              const SizedBox(height: 8),
                              Text(
                                notif.createdAt
                                    .toLocal()
                                    .toString()
                                    .split('.')[0],
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            );
          }

          if (state is NotificationError) {
            return EmptyStatePanel(
              icon: Icons.error_outline,
              title: l10n.t('load_failed_notifications'),
              message: state.message,
              actionLabel: l10n.t('retry'),
              onAction: _loadNotifications,
            );
          }

          return EmptyStatePanel(
            icon: Icons.error_outline,
            title: l10n.t('load_failed_notifications'),
            actionLabel: l10n.t('retry'),
            onAction: _loadNotifications,
          );
        },
      ),
    );
  }
}
