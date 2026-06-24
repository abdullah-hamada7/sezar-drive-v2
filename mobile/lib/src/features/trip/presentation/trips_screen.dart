import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:get_it/get_it.dart';
import 'package:url_launcher/url_launcher.dart';

import '../cubit/trip_cubit.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/theme/app_status.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../../core/widgets/list_loading_skeleton.dart';
import '../../badges/cubit/badge_cubit.dart';
import '../../../core/services/tab_badge_service.dart';

class TripsScreen extends StatefulWidget {
  final VoidCallback? onNavigateToShift;
  const TripsScreen({super.key, this.onNavigateToShift});

  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen> {
  final _noteController = TextEditingController();
  final _reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<TripCubit>().fetchMyTrips();
    _markTabViewed();
  }

  Future<void> _markTabViewed() async {
    try {
      await GetIt.I<TabBadgeService>().markTabViewed('trips');
      if (mounted) context.read<BadgeCubit>().fetchCounts();
    } catch (_) {}
  }

  @override
  void dispose() {
    _noteController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('my_trips'))),
      body: BlocConsumer<TripCubit, TripState>(
        listener: (context, state) {
          if (state is TripError) {
            AppFeedback.show(context, message: state.message, type: AppFeedbackType.error);
          }
        },
        builder: (context, state) {
          if (state is TripLoading) {
            return const ListLoadingSkeleton(itemCount: 3);
          }

          if (state is TripLoaded) {
            final trips = state.trips;
            if (trips.isEmpty) {
              return EmptyStatePanel(
                icon: Icons.route_outlined,
                title: l10n.t('no_trips'),
                message: l10n.t('no_trips_hint'),
                actionLabel: widget.onNavigateToShift != null ? l10n.t('go_to_shift') : null,
                onAction: widget.onNavigateToShift,
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: trips.length,
              itemBuilder: (context, index) => _TripCard(
                trip: trips[index],
                l10n: l10n,
                onReject: () => _showRejectDialog(context, trips[index].id, l10n),
                onCancel: () => _showCancelDialog(context, trips[index].id, l10n),
                onCashCollected: () => _showCashCollectedDialog(context, trips[index].id, l10n),
                onShowMap: () => _showMapDetailsModal(context, trips[index], l10n),
              ),
            );
          }

          return EmptyStatePanel(
            icon: Icons.error_outline,
            title: l10n.t('load_failed_trips'),
            actionLabel: l10n.t('retry'),
            onAction: () => context.read<TripCubit>().fetchMyTrips(),
          );
        },
      ),
    );
  }

  void _showCancelDialog(BuildContext context, String tripId, AppLocalizations l10n) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(l10n.t('cancel_trip_title')),
        content: TextField(
          controller: _reasonController,
          decoration: InputDecoration(labelText: l10n.t('cancel_reason_label')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: Text(l10n.t('back'))),
          ElevatedButton(
            style: dangerButtonStyle(context),
            onPressed: () {
              final reason = _reasonController.text.trim();
              if (reason.isNotEmpty) {
                Navigator.pop(dialogCtx);
                context.read<TripCubit>().cancelTrip(tripId, reason);
                _reasonController.clear();
              }
            },
            child: Text(l10n.t('cancel_trip')),
          ),
        ],
      ),
    );
  }

  void _showRejectDialog(BuildContext context, String tripId, AppLocalizations l10n) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(l10n.t('reject_trip_title')),
        content: TextField(
          controller: _reasonController,
          decoration: InputDecoration(labelText: l10n.t('reject_reason_label')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: Text(l10n.t('cancel'))),
          ElevatedButton(
            onPressed: () {
              final reason = _reasonController.text.trim();
              if (reason.isNotEmpty) {
                Navigator.pop(dialogCtx);
                context.read<TripCubit>().rejectTrip(tripId, reason);
                _reasonController.clear();
              }
            },
            child: Text(l10n.t('reject')),
          ),
        ],
      ),
    );
  }

  void _showCashCollectedDialog(BuildContext context, String tripId, AppLocalizations l10n) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(l10n.t('cash_collect_title')),
        content: TextField(
          controller: _noteController,
          decoration: InputDecoration(labelText: l10n.t('cash_note_label')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: Text(l10n.t('cancel'))),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogCtx);
              context.read<TripCubit>().collectCashPayment(tripId, _noteController.text);
            },
            child: Text(l10n.t('confirm_received')),
          ),
        ],
      ),
    );
  }

  void _showMapDetailsModal(BuildContext context, Trip trip, AppLocalizations l10n) {
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: scheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (modalCtx) {
        return SizedBox(
          height: MediaQuery.of(context).size.height * 0.75,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(l10n.t('trip_map_title'), style: Theme.of(context).textTheme.headlineMedium),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(modalCtx),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: FlutterMap(
                      options: MapOptions(
                        initialCenter: LatLng(trip.pickupLat, trip.pickupLng),
                        initialZoom: 13,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                          subdomains: const ['a', 'b', 'c'],
                        ),
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: LatLng(trip.pickupLat, trip.pickupLng),
                              width: 30,
                              height: 30,
                              child: Icon(Icons.location_on, color: semantic.success, size: 30),
                            ),
                            Marker(
                              point: LatLng(trip.dropoffLat, trip.dropoffLng),
                              width: 30,
                              height: 30,
                              child: Icon(Icons.location_on, color: semantic.danger, size: 30),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _TripCard extends StatelessWidget {
  const _TripCard({
    required this.trip,
    required this.l10n,
    required this.onReject,
    required this.onCancel,
    required this.onCashCollected,
    required this.onShowMap,
  });

  final Trip trip;
  final AppLocalizations l10n;
  final VoidCallback onReject;
  final VoidCallback onCancel;
  final VoidCallback onCashCollected;
  final VoidCallback onShowMap;

  @override
  Widget build(BuildContext context) {
    final semantic = context.semanticColors;
    final statusColor = AppStatus.tripStatus(context, trip.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                StatusChip(label: AppStatus.tripStatusLabel(l10n, trip.status), color: statusColor),
                Text('${trip.price.toStringAsFixed(2)} USD', style: Theme.of(context).textTheme.labelLarge),
              ],
            ),
            const SizedBox(height: 16),
            _PaymentRow(trip: trip, l10n: l10n),
            const SizedBox(height: 16),
            _LocationRow(icon: Icons.radio_button_checked, color: semantic.success, label: l10n.t('pickup'), value: trip.pickupLocation),
            const SizedBox(height: 8),
            _LocationRow(icon: Icons.location_on, color: semantic.danger, label: l10n.t('dropoff'), value: trip.dropoffLocation),
            if (trip.passengers != null && trip.passengers!.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 12),
              Text(l10n.t('passenger_info'), style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              ...trip.passengers!.map((p) => _PassengerRow(passenger: p, l10n: l10n)),
            ],
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onShowMap,
              icon: const Icon(Icons.map_outlined),
              label: Text(l10n.t('view_map_route')),
            ),
            const SizedBox(height: 12),
            _TripActions(
              trip: trip,
              l10n: l10n,
              onReject: onReject,
              onCancel: onCancel,
              onCashCollected: onCashCollected,
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationRow extends StatelessWidget {
  const _LocationRow({required this.icon, required this.color, required this.label, required this.value});
  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodyMedium),
              Text(value, style: Theme.of(context).textTheme.bodyLarge),
            ],
          ),
        ),
      ],
    );
  }
}

class _PassengerRow extends StatelessWidget {
  const _PassengerRow({required this.passenger, required this.l10n});
  final Passenger passenger;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(passenger.name, style: const TextStyle(fontWeight: FontWeight.w600))),
              if (passenger.phone.isNotEmpty) ...[
                IconButton(
                  icon: Icon(Icons.phone, size: 20, color: scheme.primary),
                  tooltip: l10n.t('call_passenger'),
                  onPressed: () => _launchTel(passenger.phone),
                ),
                IconButton(
                  icon: Icon(Icons.chat, size: 20, color: semantic.success),
                  tooltip: l10n.t('whatsapp_passenger'),
                  onPressed: () => _launchWhatsApp(passenger.phone),
                ),
              ],
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (passenger.phone.isNotEmpty)
                Text(passenger.phone, style: Theme.of(context).textTheme.bodyMedium),
              Text(l10n.t('companion_count', {'count': '${passenger.companionCount}'}), style: Theme.of(context).textTheme.bodyMedium),
              Text(l10n.t('bag_count', {'count': '${passenger.bagCount}'}), style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _launchTel(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _launchWhatsApp(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('https://wa.me/${digits.replaceAll('+', '')}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.trip, required this.l10n});
  final Trip trip;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final semantic = context.semanticColors;
    final method = trip.paymentMethod.toUpperCase();
    final label = AppStatus.paymentLabel(l10n, method);
    final isCash = method == 'CASH';

    return Row(
      children: [
        Icon(isCash ? Icons.payments : Icons.credit_card, size: 18, color: isCash ? semantic.warning : semantic.success),
        const SizedBox(width: 8),
        Text(l10n.t('payment_label', {'method': label}), style: const TextStyle(fontSize: 13)),
        const Spacer(),
        if (isCash && trip.status == 'COMPLETED')
          StatusChip(
            label: trip.cashCollectedAt != null
                ? l10n.t('cash_collected')
                : l10n.t('collect_amount', {'amount': trip.price.toStringAsFixed(2)}),
            color: trip.cashCollectedAt != null ? semantic.success : semantic.danger,
          )
        else if (!isCash)
          StatusChip(label: l10n.t('paid'), color: semantic.success),
      ],
    );
  }
}

class _TripActions extends StatelessWidget {
  const _TripActions({
    required this.trip,
    required this.l10n,
    required this.onReject,
    required this.onCancel,
    required this.onCashCollected,
  });

  final Trip trip;
  final AppLocalizations l10n;
  final VoidCallback onReject;
  final VoidCallback onCancel;
  final VoidCallback onCashCollected;

  void _confirm(BuildContext context, {required String title, required String message, required VoidCallback onConfirm, required Color color}) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: Text(l10n.t('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: color, foregroundColor: Colors.white),
            onPressed: () {
              Navigator.pop(dialogCtx);
              onConfirm();
            },
            child: Text(l10n.t('confirm')),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<TripCubit>();
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    if (trip.status == 'ASSIGNED') {
      return Row(
        children: [
          Expanded(
            child: ElevatedButton(
              style: successButtonStyle(context),
              onPressed: () => _confirm(
                context,
                title: l10n.t('accept_trip_title'),
                message: l10n.t('accept_trip_message'),
                onConfirm: () => cubit.acceptTrip(trip.id),
                color: semantic.success,
              ),
              child: Text(l10n.t('accept')),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: semantic.danger, side: BorderSide(color: semantic.danger)),
              onPressed: onReject,
              child: Text(l10n.t('reject')),
            ),
          ),
        ],
      );
    }

    if (trip.status == 'ACCEPTED') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton(
            style: primaryButtonStyle(context),
            onPressed: () => _confirm(
              context,
              title: l10n.t('start_trip_title'),
              message: l10n.t('start_trip_message'),
              onConfirm: () => cubit.startTrip(trip.id),
              color: scheme.primary,
            ),
            child: Text(l10n.t('start_trip')),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            style: OutlinedButton.styleFrom(foregroundColor: semantic.danger, side: BorderSide(color: semantic.danger)),
            onPressed: onCancel,
            child: Text(l10n.t('cancel_trip')),
          ),
        ],
      );
    }

    if (trip.status == 'IN_PROGRESS') {
      return ElevatedButton(
        style: successButtonStyle(context),
        onPressed: () => _confirm(
          context,
          title: l10n.t('complete_trip_title'),
          message: l10n.t('complete_trip_message'),
          onConfirm: () => cubit.completeTrip(trip.id),
          color: semantic.success,
        ),
        child: Text(l10n.t('complete_trip')),
      );
    }

    if (trip.status == 'COMPLETED' && trip.paymentMethod == 'CASH' && trip.cashCollectedAt == null) {
      return ElevatedButton(
        style: warningButtonStyle(context),
        onPressed: onCashCollected,
        child: Text(l10n.t('mark_cash_collected')),
      );
    }

    return const SizedBox.shrink();
  }
}
