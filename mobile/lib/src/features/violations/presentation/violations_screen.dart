import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../../core/widgets/list_loading_skeleton.dart';
import '../../badges/cubit/badge_cubit.dart';
import '../../../core/services/tab_badge_service.dart';
import '../cubit/violation_cubit.dart';

class ViolationsScreen extends StatefulWidget {
  const ViolationsScreen({super.key});

  @override
  State<ViolationsScreen> createState() => _ViolationsScreenState();
}

class _ViolationsScreenState extends State<ViolationsScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ViolationCubit>().fetchMyViolations();
    _markTabViewed();
  }

  Future<void> _markTabViewed() async {
    try {
      await GetIt.I<TabBadgeService>().markTabViewed('violations');
      if (mounted) context.read<BadgeCubit>().fetchCounts();
    } catch (_) {}
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _pickDateRange() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: now,
      initialDateRange: DateTimeRange(start: now.subtract(const Duration(days: 30)), end: now),
    );
    if (range != null && mounted) {
      context.read<ViolationCubit>().setDateFilter(range.start, range.end);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final semantic = context.semanticColors;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('traffic_violations')),
        actions: [
          IconButton(icon: const Icon(Icons.filter_list), onPressed: _pickDateRange),
          IconButton(
            icon: const Icon(Icons.clear_all),
            onPressed: () {
              _searchController.clear();
              context.read<ViolationCubit>().clearFilters();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: l10n.t('violations_search_hint'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          context.read<ViolationCubit>().setSearchQuery('');
                        },
                      )
                    : null,
              ),
              onChanged: (v) => context.read<ViolationCubit>().setSearchQuery(v),
            ),
          ),
          Expanded(
            child: BlocBuilder<ViolationCubit, ViolationState>(
              builder: (context, state) {
                if (state is ViolationLoading) {
                  return const ListLoadingSkeleton(itemCount: 3, itemHeight: 80);
                }

                if (state is ViolationLoaded) {
                  final violations = state.filtered;
                  if (violations.isEmpty) {
                    return EmptyStatePanel(
                      icon: Icons.gavel_outlined,
                      title: state.violations.isEmpty ? l10n.t('violations_empty') : l10n.t('violations_no_match'),
                      message: state.violations.isEmpty ? l10n.t('violations_empty_hint') : null,
                      actionLabel: state.violations.isNotEmpty ? l10n.t('clear_filters') : null,
                      onAction: state.violations.isNotEmpty
                          ? () {
                              _searchController.clear();
                              context.read<ViolationCubit>().clearFilters();
                            }
                          : null,
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: violations.length,
                    itemBuilder: (context, index) {
                      final vio = violations[index];
                      final isUnseen = vio.seenAt == null;

                      return Card(
                        color: isUnseen ? semantic.statusBackground(semantic.danger, opacity: 0.08) : null,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: isUnseen ? semantic.danger.withValues(alpha: 0.45) : semantic.border,
                          ),
                        ),
                        child: ExpansionTile(
                          title: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  l10n.t('violation_number', {'number': vio.violationNumber}),
                                  style: TextStyle(fontWeight: isUnseen ? FontWeight.w600 : FontWeight.normal),
                                ),
                              ),
                              if (isUnseen) CircleAvatar(radius: 4, backgroundColor: semantic.danger),
                            ],
                          ),
                          subtitle: Text(l10n.t('fine_amount', {'amount': vio.fineAmount.toStringAsFixed(2)})),
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(l10n.t('location_label', {'value': vio.location})),
                                  Text(l10n.t('date_label', {'value': vio.date.toLocal().toString().split(' ')[0]})),
                                  Text(l10n.t('time_label', {'value': vio.time})),
                                  if (vio.photoUrl != null) ...[
                                    const SizedBox(height: 12),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.network(vio.photoUrl!, height: 180, fit: BoxFit.cover),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  );
                }

                return EmptyStatePanel(
                  icon: Icons.error_outline,
                  title: l10n.t('load_failed_violations'),
                  actionLabel: l10n.t('retry'),
                  onAction: () => context.read<ViolationCubit>().fetchMyViolations(),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
