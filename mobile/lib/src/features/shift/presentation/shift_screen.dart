import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:image_picker/image_picker.dart';

import '../cubit/shift_cubit.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/theme/app_status.dart';
import '../../../core/utils/qr_normalizer.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../../core/widgets/list_loading_skeleton.dart';
import '../../badges/cubit/badge_cubit.dart';
import '../../../core/services/tab_badge_service.dart';
import 'qr_scanner_screen.dart';

class ShiftScreen extends StatefulWidget {
  final VoidCallback? onNavigateToInspection;
  final VoidCallback? onNavigateToTrips;
  const ShiftScreen({
    super.key,
    this.onNavigateToInspection,
    this.onNavigateToTrips,
  });

  @override
  State<ShiftScreen> createState() => _ShiftScreenState();
}

class _ShiftScreenState extends State<ShiftScreen> {
  final _qrController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ShiftCubit>().fetchActiveShift();
    _markTabViewed();
  }

  Future<void> _markTabViewed() async {
    try {
      await GetIt.I<TabBadgeService>().markTabViewed('shift');
      if (mounted) context.read<BadgeCubit>().fetchCounts();
    } catch (_) {}
  }

  @override
  void dispose() {
    _qrController.dispose();
    super.dispose();
  }

  Future<void> _openQrScanner() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QrScannerScreen(
          onScanned: (code) {
            context.read<ShiftCubit>().scanQRAndAssignVehicle(normalizeScannedQrValue(code));
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('shift_management'))),
      body: BlocConsumer<ShiftCubit, ShiftState>(
        listener: (context, state) {
          if (state is ShiftError) {
            AppFeedback.show(context, message: state.message, type: AppFeedbackType.error);
          } else if (state is ShiftActivated) {
            AppFeedback.show(context, message: l10n.t('shift_activated'), type: AppFeedbackType.success);
            widget.onNavigateToTrips?.call();
          } else if (state is ShiftInspectionRequired) {
            AppFeedback.show(context, message: l10n.t('shift_inspection_required'), type: AppFeedbackType.warning);
            widget.onNavigateToInspection?.call();
            context.read<ShiftCubit>().restoreLoaded(state.activeShift, preShiftInspectionComplete: false);
          } else if (state is ShiftPostInspectionRequired) {
            AppFeedback.show(context, message: l10n.t('shift_post_inspection_required'), type: AppFeedbackType.warning);
            widget.onNavigateToInspection?.call();
            context.read<ShiftCubit>().restoreLoaded(state.activeShift, preShiftInspectionComplete: false);
          } else if (state is ShiftActiveTripBlocked) {
            AppFeedback.show(context, message: l10n.t('shift_trip_blocked'), type: AppFeedbackType.warning);
            widget.onNavigateToTrips?.call();
            context.read<ShiftCubit>().restoreLoaded(state.activeShift, preShiftInspectionComplete: false);
          }
        },
        builder: (context, state) {
          if (state is ShiftLoading) {
            return const ListLoadingSkeleton(itemCount: 2, itemHeight: 88);
          }

          if (state is ShiftLoaded) {
            final shift = state.activeShift;
            if (shift == null) {
              return EmptyStatePanel(
                icon: Icons.timer_outlined,
                title: l10n.t('no_active_shift'),
                message: l10n.t('no_active_shift_hint'),
                actionLabel: l10n.t('start_work_shift'),
                onAction: () => context.read<ShiftCubit>().startShift(),
              );
            }

            if (shift.status == 'PendingVerification') {
              return _VerificationFlow(
                shift: shift,
                inspectionComplete: state.preShiftInspectionComplete,
                l10n: l10n,
                onOpenQr: _openQrScanner,
                onManualQr: () => _showManualQrInput(context, l10n),
                onInspect: widget.onNavigateToInspection,
                onActivate: () => context.read<ShiftCubit>().activateShift(shift.id),
                onCaptureFace: () => _captureFace(context, l10n),
              );
            }

            return Padding(
              padding: const EdgeInsets.all(24),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.check_circle, color: context.semanticColors.success, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(l10n.t('shift_is_active'), style: Theme.of(context).textTheme.headlineMedium),
                                Text(
                                  l10n.t('vehicle_label', {'plate': shift.vehicle?.plateNumber ?? '—'}),
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      OutlinedButton(
                        onPressed: () => _confirmCloseShift(context, shift, l10n),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: context.semanticColors.danger,
                          side: BorderSide(color: context.semanticColors.danger),
                        ),
                        child: Text(l10n.t('end_work_shift')),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return EmptyStatePanel(
            icon: Icons.error_outline,
            title: l10n.t('state_error'),
            actionLabel: l10n.t('retry'),
            onAction: () => context.read<ShiftCubit>().fetchActiveShift(),
          );
        },
      ),
    );
  }

  Future<void> _captureFace(BuildContext context, AppLocalizations l10n) async {
    try {
      final picker = ImagePicker();
      final xFile = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85,
      );
      if (xFile == null) {
        if (context.mounted) {
          AppFeedback.show(context, message: l10n.t('selfie_required'), type: AppFeedbackType.warning);
        }
        return;
      }
      if (context.mounted) {
        context.read<ShiftCubit>().verifyFace(File(xFile.path));
      }
    } catch (e) {
      if (context.mounted) {
        AppFeedback.show(
          context,
          message: 'Camera error: ${e.toString()}',
          type: AppFeedbackType.error,
        );
      }
    }
  }

  void _confirmCloseShift(BuildContext context, Shift shift, AppLocalizations l10n) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(l10n.t('end_shift_title')),
        content: Text(l10n.t('end_shift_message')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: Text(l10n.t('cancel'))),
          ElevatedButton(
            style: dangerButtonStyle(context),
            onPressed: () {
              Navigator.pop(dialogCtx);
              context.read<ShiftCubit>().closeShift(shift);
            },
            child: Text(l10n.t('end_shift')),
          ),
        ],
      ),
    );
  }

  void _showManualQrInput(BuildContext context, AppLocalizations l10n) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(l10n.t('enter_vehicle_qr')),
        content: TextField(
          controller: _qrController,
          decoration: InputDecoration(labelText: l10n.t('qr_identifier')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: Text(l10n.t('cancel'))),
          ElevatedButton(
            onPressed: () {
              final code = normalizeScannedQrValue(_qrController.text);
              if (code.isNotEmpty) {
                Navigator.pop(dialogCtx);
                context.read<ShiftCubit>().scanQRAndAssignVehicle(code);
              }
            },
            child: Text(l10n.t('assign')),
          ),
        ],
      ),
    );
  }
}

class _VerificationFlow extends StatelessWidget {
  const _VerificationFlow({
    required this.shift,
    required this.inspectionComplete,
    required this.l10n,
    required this.onOpenQr,
    required this.onManualQr,
    required this.onInspect,
    required this.onActivate,
    required this.onCaptureFace,
  });

  final Shift shift;
  final bool inspectionComplete;
  final AppLocalizations l10n;
  final VoidCallback onOpenQr;
  final VoidCallback onManualQr;
  final VoidCallback? onInspect;
  final VoidCallback onActivate;
  final VoidCallback onCaptureFace;

  @override
  Widget build(BuildContext context) {
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;
    final isVerified = shift.verificationStatus == 'VERIFIED';
    final hasVehicle = shift.vehicleId != null || shift.vehicle != null;
    final ready = isVerified && hasVehicle && inspectionComplete;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.t('shift_activation_required'), style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(l10n.t('shift_activation_steps'), style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 24),
          _StepTile(
            done: isVerified,
            icon: isVerified ? Icons.check_circle : Icons.face,
            activeColor: isVerified ? semantic.success : scheme.primary,
            title: l10n.t('face_verification'),
            subtitle: isVerified ? l10n.t('face_verified') : l10n.t('face_pending'),
            trailing: isVerified
                ? null
                : ElevatedButton(onPressed: onCaptureFace, child: Text(l10n.t('capture_selfie'))),
          ),
          const Divider(height: 32),
          _StepTile(
            done: hasVehicle,
            icon: hasVehicle ? Icons.check_circle : Icons.qr_code,
            activeColor: hasVehicle ? semantic.success : scheme.primary,
            title: l10n.t('vehicle_qr'),
            subtitle: hasVehicle
                ? l10n.t('vehicle_assigned', {'plate': shift.vehicle?.plateNumber ?? '—'})
                : l10n.t('scan_vehicle_qr'),
            trailing: hasVehicle
                ? null
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(icon: const Icon(Icons.qr_code_scanner), tooltip: l10n.t('scan_qr'), onPressed: onOpenQr),
                      IconButton(icon: const Icon(Icons.keyboard), tooltip: l10n.t('enter_manually'), onPressed: onManualQr),
                    ],
                  ),
          ),
          const Divider(height: 32),
          _StepTile(
            done: inspectionComplete,
            icon: inspectionComplete ? Icons.check_circle : Icons.fact_check,
            activeColor: inspectionComplete ? semantic.success : scheme.primary,
            title: l10n.t('vehicle_inspection_step'),
            subtitle: inspectionComplete ? l10n.t('inspection_done') : l10n.t('inspection_pending'),
            trailing: inspectionComplete
                ? null
                : TextButton(onPressed: onInspect, child: Text(l10n.t('inspect'))),
          ),
          const SizedBox(height: 32),
          ElevatedButton(onPressed: ready ? onActivate : null, child: Text(l10n.t('activate_go_online'))),
        ],
      ),
    );
  }
}

class _StepTile extends StatelessWidget {
  const _StepTile({
    required this.done,
    required this.icon,
    required this.activeColor,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final bool done;
  final IconData icon;
  final Color activeColor;
  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: activeColor),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle),
      trailing: trailing,
    );
  }
}
