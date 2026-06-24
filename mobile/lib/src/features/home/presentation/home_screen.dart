import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../cubit/home_cubit.dart';
import '../../shift/presentation/qr_scanner_screen.dart' show DriverDetailsSheet;
import '../../../core/theme/app_theme.dart';
import '../../auth/presentation/identity_verification_screen.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/theme/app_status.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/list_loading_skeleton.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback? onNavigateToTrips;
  const HomeScreen({super.key, this.onNavigateToTrips});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    context.read<HomeCubit>().fetchHomeData();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocListener<AuthCubit, AuthState>(
      listener: (context, state) {
        if (state is AuthPasswordChanged) {
          AppFeedback.show(context, message: l10n.t('password_updated'), type: AppFeedbackType.success);
        } else if (state is AuthError) {
          AppFeedback.show(context, message: state.message, type: AppFeedbackType.error);
        }
      },
      child: Scaffold(
      appBar: AppBar(title: Text(l10n.t('dashboard'))),
      body: BlocBuilder<HomeCubit, HomeState>(
        builder: (context, state) {
          if (state is HomeLoading) {
            return const ListLoadingSkeleton(itemCount: 3, itemHeight: 96);
          }
          if (state is HomeError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(state.message, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => context.read<HomeCubit>().fetchHomeData(),
                    child: Text(l10n.t('retry')),
                  ),
                ],
              ),
            );
          }
          if (state is HomeLoaded) {
            return RefreshIndicator(
              onRefresh: () => context.read<HomeCubit>().fetchHomeData(),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (state.isStale)
                    SemanticBanner(
                      message: l10n.t('cached_offline'),
                      icon: Icons.cloud_off,
                      background: context.semanticColors.warning,
                      foreground: AppTheme.backgroundColor,
                    ),
                  if (!state.user.identityVerified)
                    Card(
                      color: context.semanticColors.statusBackground(context.semanticColors.warning),
                      child: ListTile(
                        leading: Icon(Icons.verified_user, color: context.semanticColors.warning),
                        title: Text(l10n.t('identity_required'), style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(l10n.t('identity_upload_hint')),
                        trailing: TextButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const IdentityVerificationScreen()),
                            );
                          },
                          child: Text(l10n.t('upload')),
                        ),
                      ),
                    ),
                  _ProfileCard(
                    user: state.user,
                    onDetails: () => showModalBottomSheet(
                      context: context,
                      builder: (_) => DriverDetailsSheet(user: state.user),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (state.activeShift?.status == 'Active')
                    _ShiftStatusCard(
                      title: l10n.t('shift_active'),
                      subtitle: l10n.t('vehicle_label', {'plate': state.activeShift?.vehicle?.plateNumber ?? '—'}),
                      color: context.semanticColors.success,
                    )
                  else if (state.activeShift?.status == 'PendingVerification')
                    _ShiftStatusCard(
                      title: l10n.t('shift_pending'),
                      subtitle: l10n.t('complete_verification_subtitle'),
                      color: context.semanticColors.warning,
                    ),
                  const SizedBox(height: 12),
                  _CashSummaryCard(
                    report: state.dailyReport,
                    l10n: l10n,
                    onGoToTrips: widget.onNavigateToTrips,
                  ),
                  const SizedBox(height: 16),
                  _EarningsChartCard(history: state.earningsHistory, l10n: l10n),
                  const SizedBox(height: 16),
                  _RecentActivityCard(
                    activities: state.recentActivity,
                    l10n: l10n,
                    onViewAll: widget.onNavigateToTrips,
                  ),
                ],
              ),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  final dynamic user;
  final VoidCallback onDetails;
  const _ProfileCard({required this.user, required this.onDetails});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundImage: user.avatarUrl != null ? NetworkImage(user.avatarUrl as String) : null,
          child: user.avatarUrl == null ? const Icon(Icons.person) : null,
        ),
        title: Text(user.name as String, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(user.email as String),
        trailing: IconButton(icon: const Icon(Icons.info_outline), onPressed: onDetails),
      ),
    );
  }
}

class _ShiftStatusCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final Color color;
  const _ShiftStatusCard({required this.title, required this.subtitle, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: context.semanticColors.statusBackground(color),
      child: ListTile(
        leading: Icon(Icons.timer, color: color),
        title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
        subtitle: Text(subtitle),
      ),
    );
  }
}

class _CashSummaryCard extends StatelessWidget {
  final DailyReport report;
  final AppLocalizations l10n;
  final VoidCallback? onGoToTrips;
  const _CashSummaryCard({required this.report, required this.l10n, this.onGoToTrips});

  @override
  Widget build(BuildContext context) {
    final semantic = context.semanticColors;
    final hasUncollected = report.uncollectedCashTotal > 0;
    return Card(
      color: hasUncollected ? semantic.statusBackground(semantic.danger, opacity: 0.1) : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.t('todays_cash'), style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            Text(
              hasUncollected
                  ? l10n.t('uncollected_cash', {
                      'count': '${report.uncollectedCashTripsCount}',
                      'amount': report.uncollectedCashTotal.toStringAsFixed(2),
                    })
                  : l10n.t('no_uncollected_cash'),
              style: TextStyle(color: hasUncollected ? semantic.danger : semantic.muted),
            ),
            Text(
              l10n.t('collected_cash', {
                'count': '${report.cashCollectedTripsCount}',
                'amount': report.cashCollectedTotal.toStringAsFixed(2),
              }),
              style: TextStyle(color: semantic.muted),
            ),
            if (onGoToTrips != null) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(onPressed: onGoToTrips, child: Text(l10n.t('go_to_trips'))),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EarningsChartCard extends StatelessWidget {
  final List<EarningsPoint> history;
  final AppLocalizations l10n;
  const _EarningsChartCard({required this.history, required this.l10n});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;

    final nonZero = history.where((p) => p.amount > 0).toList();
    final maxAmount = nonZero.isEmpty ? 1.0 : nonZero.fold<double>(0, (max, p) => p.amount > max ? p.amount : max);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.t('daily_earnings'), style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 16),
            SizedBox(
              height: 140,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: history.asMap().entries.map((entry) {
                  final point = entry.value;
                  final barHeight = maxAmount > 0 ? (point.amount / maxAmount) * 100 : 0.0;
                  final showLabel = entry.key % 3 == 0;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          if (point.amount > 0)
                            Text('\$${point.amount.toStringAsFixed(0)}', style: TextStyle(fontSize: 8, color: semantic.muted)),
                          const SizedBox(height: 2),
                          Container(
                            height: barHeight.clamp(2.0, 100.0),
                            decoration: BoxDecoration(
                              color: scheme.primary,
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            showLabel ? point.hour.split(':').first : '',
                            style: TextStyle(fontSize: 8, color: semantic.muted),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentActivityCard extends StatelessWidget {
  final List<RecentActivity> activities;
  final AppLocalizations l10n;
  final VoidCallback? onViewAll;
  const _RecentActivityCard({required this.activities, required this.l10n, this.onViewAll});

  IconData _typeIcon(String type) {
    switch (type) {
      case 'trip':
        return Icons.route;
      case 'expense':
        return Icons.receipt;
      default:
        return Icons.circle;
    }
  }

  String _formatTime(AppLocalizations l10n, DateTime ts) {
    final diff = DateTime.now().difference(ts);
    if (diff.inMinutes < 1) return l10n.t('just_now');
    if (diff.inHours < 1) return l10n.t('minutes_ago', {'n': '${diff.inMinutes}'});
    if (diff.inHours < 24) return l10n.t('hours_ago', {'n': '${diff.inHours}'});
    return '${ts.year}-${ts.month.toString().padLeft(2, '0')}-${ts.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l10n.t('recent_activity'), style: Theme.of(context).textTheme.labelLarge),
                if (onViewAll != null)
                  TextButton(onPressed: onViewAll, child: Text(l10n.t('view_all'))),
              ],
            ),
            const SizedBox(height: 8),
            if (activities.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text(l10n.t('no_recent_activity'), style: TextStyle(color: semantic.muted))),
              )
            else
              ...activities.map((a) => ListTile(
                    leading: Icon(_typeIcon(a.type), color: scheme.primary),
                    title: Text(a.title, style: const TextStyle(fontSize: 14)),
                    subtitle: Text('${a.status} · ${_formatTime(l10n, a.timestamp)}', style: const TextStyle(fontSize: 11)),
                    trailing: a.amount != null
                        ? Text(
                            '${a.amount! >= 0 ? '' : '-'}\$${a.amount!.abs().toStringAsFixed(2)}',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: (a.amount ?? 0) < 0 ? semantic.danger : semantic.success,
                            ),
                          )
                        : null,
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  )),
          ],
        ),
      ),
    );
  }
}
