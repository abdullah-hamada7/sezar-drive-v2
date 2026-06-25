import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/theme/app_status.dart';
import '../../../core/services/connectivity_service.dart';
import '../../../core/services/tab_badge_service.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../../core/widgets/fleet_shell.dart';
import '../../shift/cubit/shift_cubit.dart';
import '../cubit/damage_cubit.dart';

class DamageScreen extends StatefulWidget {
  const DamageScreen({super.key});

  @override
  State<DamageScreen> createState() => _DamageScreenState();
}

class _DamageScreenState extends State<DamageScreen> {
  final _descController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final List<File> _photos = [];
  bool _isOnline = true;
  StreamSubscription<bool>? _connSub;

  @override
  void initState() {
    super.initState();
    _markTabViewed();
    _connSub = GetIt.I<ConnectivityService>().onConnectivityChanged.listen((online) {
      if (mounted) setState(() => _isOnline = online);
    });
    GetIt.I<ConnectivityService>().checkNow().then((online) {
      if (mounted) setState(() => _isOnline = online);
    });
  }

  Future<void> _markTabViewed() async {
    try {
      await GetIt.I<TabBadgeService>().markTabViewed('damage');
    } catch (_) {}
  }

  @override
  void dispose() {
    _connSub?.cancel();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _addPhoto(AppLocalizations l10n) async {
    if (_photos.length >= 3) {
      AppFeedback.show(context, message: l10n.t('damage_photo_max'), type: AppFeedbackType.warning);
      return;
    }
    try {
      final image = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 70);
      if (image != null && mounted) setState(() => _photos.add(File(image.path)));
    } catch (e) {
      if (mounted) {
        AppFeedback.show(
          context,
          message: 'Camera error: ${e.toString()}',
          type: AppFeedbackType.error,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final shiftState = context.watch<ShiftCubit>().state;
    final hasActiveShift = shiftState is ShiftLoaded && shiftState.activeShift != null;
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: FleetAppBar(title: l10n.t('report_damage')),
      body: BlocConsumer<DamageCubit, DamageState>(
        listener: (context, state) {
          if (state is DamageReported) {
            AppFeedback.show(
              context,
              message: state.isOffline ? l10n.t('damage_queued') : l10n.t('damage_submitted'),
              type: AppFeedbackType.success,
            );
            _descController.clear();
            setState(() => _photos.clear());
          } else if (state is DamageError) {
            AppFeedback.show(context, message: state.message, type: AppFeedbackType.error);
          }
        },
        builder: (context, state) {
          if (state is DamageLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!hasActiveShift) {
            return EmptyStatePanel(
              icon: Icons.car_crash_outlined,
              title: l10n.t('report_damage'),
              message: l10n.t('damage_shift_required'),
            );
          }

          final shift = shiftState.activeShift!;
          final vehicleId = shift.vehicleId ?? shift.vehicle?.id ?? 'vehicle_unknown';

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!_isOnline)
                    SemanticBanner(
                      message: l10n.t('damage_offline_queued'),
                      icon: Icons.cloud_off,
                      background: semantic.warning,
                    ),
                  SemanticBanner(
                    message: l10n.t('damage_lock_warning'),
                    icon: Icons.lock_outline,
                    background: semantic.danger,
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _descController,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: l10n.t('damage_description'),
                      hintText: l10n.t('damage_description_hint'),
                    ),
                    validator: (value) => value == null || value.isEmpty ? l10n.t('enter_description') : null,
                  ),
                  const SizedBox(height: 20),
                  Text(l10n.t('damage_photos_label'), style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 12,
                    children: [
                      ..._photos.map(
                        (file) => Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.file(file, width: 80, height: 80, fit: BoxFit.cover),
                            ),
                            Positioned(
                              right: 0,
                              top: 0,
                              child: InkWell(
                                onTap: () => setState(() => _photos.remove(file)),
                                child: CircleAvatar(
                                  radius: 10,
                                  backgroundColor: semantic.danger,
                                  child: const Icon(Icons.close, size: 12, color: Colors.white),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_photos.length < 3)
                        InkWell(
                          onTap: () => _addPhoto(l10n),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: scheme.surface,
                              border: Border.all(color: semantic.border),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.add_a_photo, color: semantic.muted),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    style: dangerButtonStyle(context),
                    onPressed: () {
                      if (_formKey.currentState!.validate()) {
                        if (_photos.isEmpty) {
                          AppFeedback.show(context, message: l10n.t('damage_photo_required'), type: AppFeedbackType.warning);
                          return;
                        }
                        context.read<DamageCubit>().submitDamageReport(
                              shiftId: shift.id,
                              vehicleId: vehicleId,
                              description: _descController.text,
                              photos: _photos,
                              isOnline: _isOnline,
                            );
                      }
                    },
                    child: Text(l10n.t('submit_damage')),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
