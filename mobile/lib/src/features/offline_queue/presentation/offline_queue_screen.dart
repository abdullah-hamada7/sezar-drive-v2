import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_status.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../../core/widgets/list_loading_skeleton.dart';
import '../../../core/widgets/fleet_shell.dart';
import '../cubit/offline_queue_cubit.dart';

class OfflineQueueScreen extends StatefulWidget {
  const OfflineQueueScreen({super.key});

  @override
  State<OfflineQueueScreen> createState() => _OfflineQueueScreenState();
}

class _OfflineQueueScreenState extends State<OfflineQueueScreen> {
  @override
  void initState() {
    super.initState();
    context.read<OfflineQueueCubit>().fetchQueue();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: FleetAppBar(
        title: l10n.t('offline_queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () => context.read<OfflineQueueCubit>().syncNow(),
            tooltip: l10n.t('sync_queue'),
          ),
          IconButton(
            icon: const Icon(Icons.delete_sweep),
            onPressed: () => context.read<OfflineQueueCubit>().clearAllQueue(),
            tooltip: l10n.t('clear_queue'),
          ),
        ],
      ),
      body: BlocConsumer<OfflineQueueCubit, OfflineQueueState>(
        listener: (context, state) {
          if (state is OfflineQueueSyncSuccess) {
            AppFeedback.show(
              context,
              message: l10n.t('sync_complete', {'synced': '${state.synced}', 'failed': '${state.failed}'}),
              type: state.failed > 0 ? AppFeedbackType.warning : AppFeedbackType.success,
            );
          } else if (state is OfflineQueueError) {
            AppFeedback.show(context, message: state.message, type: AppFeedbackType.error);
          }
        },
        builder: (context, state) {
          if (state is OfflineQueueLoading) {
            return const ListLoadingSkeleton(itemCount: 3, itemHeight: 72);
          }

          if (state is OfflineQueueLoaded) {
            final items = state.items;
            if (items.isEmpty) {
              return EmptyStatePanel(
                icon: Icons.cloud_done_outlined,
                title: l10n.t('offline_queue_empty'),
                message: l10n.t('offline_queue_empty_hint'),
              );
            }

            return Column(
              children: [
                Container(
                  color: semantic.statusBackground(scheme.primary),
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(l10n.t('pending_items', {'count': '${items.length}'}), style: Theme.of(context).textTheme.labelLarge),
                      ElevatedButton.icon(
                        onPressed: () => context.read<OfflineQueueCubit>().syncNow(),
                        icon: const Icon(Icons.cloud_upload_outlined, size: 18),
                        label: Text(l10n.t('upload_queue')),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      final id = item['id'] as String;
                      final type = item['body']?['__offlineType'] ?? 'general';
                      final timestamp = item['timestamp'] as int;
                      final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
                      final typeStr = type.toString();
                      final avatarColor = AppStatus.offlineQueueTypeColor(context, typeStr);

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: avatarColor,
                            child: Icon(_iconForType(typeStr), color: Colors.white, size: 20),
                          ),
                          title: Text(typeStr.replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(l10n.t('queued_at', {'time': date.toLocal().toString().split('.')[0]})),
                          trailing: IconButton(
                            icon: Icon(Icons.delete_outline, color: semantic.danger),
                            onPressed: () => context.read<OfflineQueueCubit>().removeQueueItem(id),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            );
          }

          return EmptyStatePanel(
            icon: Icons.error_outline,
            title: l10n.t('load_failed_queue'),
            actionLabel: l10n.t('retry'),
            onAction: () => context.read<OfflineQueueCubit>().fetchQueue(),
          );
        },
      ),
    );
  }

  IconData _iconForType(String type) {
    if (type.contains('inspection')) return Icons.fact_check_outlined;
    if (type.contains('expense')) return Icons.receipt_long;
    if (type.contains('damage')) return Icons.car_crash_outlined;
    return Icons.cloud_queue;
  }
}
