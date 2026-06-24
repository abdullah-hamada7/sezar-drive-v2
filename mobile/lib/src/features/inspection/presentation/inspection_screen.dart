import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/services/connectivity_service.dart';
import '../../../core/services/tab_badge_service.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../badges/cubit/badge_cubit.dart';
import '../../shift/cubit/shift_cubit.dart';
import '../cubit/inspection_cubit.dart';

class InspectionScreen extends StatefulWidget {
  const InspectionScreen({super.key});

  @override
  State<InspectionScreen> createState() => _InspectionScreenState();
}

class _InspectionScreenState extends State<InspectionScreen> {
  final _picker = ImagePicker();
  final _notesController = TextEditingController();
  final _checks = <String, String>{};
  final _directionalPhotos = <String, File>{};
  final _issuePhotos = <String, File>{};

  final _checklistItems = ['tires', 'lights', 'brakes', 'mirrors', 'fluids', 'seatbelts', 'horn', 'wipers'];
  final _directions = ['front', 'back', 'left', 'right', 'dashboard', 'tank'];

  int _currentStep = 0;
  bool _isOnline = true;
  StreamSubscription<bool>? _connSub;

  @override
  void initState() {
    super.initState();
    for (final item in _checklistItems) {
      _checks[item] = 'good';
    }
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
      await GetIt.I<TabBadgeService>().markTabViewed('inspection');
      if (mounted) context.read<BadgeCubit>().fetchCounts();
    } catch (_) {}
  }

  void _resetWizard() {
    setState(() {
      _currentStep = 0;
      _directionalPhotos.clear();
      _issuePhotos.clear();
      _notesController.clear();
      for (final item in _checklistItems) {
        _checks[item] = 'good';
      }
    });
  }

  @override
  void dispose() {
    _connSub?.cancel();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _captureDirectionPhoto(String direction) async {
    try {
      final image = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70);
      if (image != null && mounted) {
        setState(() => _directionalPhotos[direction] = File(image.path));
      }
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

  Future<void> _captureIssuePhoto(String item) async {
    try {
      final image = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70);
      if (image != null && mounted) {
        setState(() => _issuePhotos[item] = File(image.path));
      }
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

    if (shiftState is! ShiftLoaded || shiftState.activeShift == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.t('vehicle_inspection'))),
        body: EmptyStatePanel(
          icon: Icons.fact_check_outlined,
          title: l10n.t('vehicle_inspection'),
          message: l10n.t('inspection_shift_required'),
        ),
      );
    }

    final shift = shiftState.activeShift!;
    final vehicleId = shift.vehicleId ?? shift.vehicle?.id ?? 'vehicle_unknown';

    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('vehicle_inspection'))),
      body: BlocConsumer<InspectionCubit, InspectionState>(
        listener: (context, state) {
          if (state is InspectionSuccess) {
            context.read<ShiftCubit>().fetchActiveShift();
            AppFeedback.show(
              context,
              message: state.isOffline ? l10n.t('inspection_queued') : l10n.t('inspection_submitted'),
              type: AppFeedbackType.success,
            );
            _resetWizard();
          } else if (state is InspectionError) {
            AppFeedback.show(context, message: state.message, type: AppFeedbackType.error);
          }
        },
        builder: (context, state) {
          if (state is InspectionLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return Column(
            children: [
              Container(
                color: Theme.of(context).colorScheme.surface,
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildStepHeader(context, l10n, 0, l10n.t('step_checklist')),
                    _buildStepHeader(context, l10n, 1, l10n.t('step_photos')),
                    _buildStepHeader(context, l10n, 2, l10n.t('step_review')),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: _buildCurrentStepView(context, l10n, vehicleId, shift.id, shift.status),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStepHeader(BuildContext context, AppLocalizations l10n, int index, String title) {
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;
    final isActive = _currentStep == index;
    final isDone = _currentStep > index;
    final canTap = index < _currentStep;

    return InkWell(
      onTap: canTap ? () => setState(() => _currentStep = index) : null,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 12,
              backgroundColor: isDone ? semantic.success : (isActive ? scheme.primary : semantic.muted),
              child: Text(
                '${index + 1}',
                style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                color: isActive ? Theme.of(context).colorScheme.onSurface : semantic.muted,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentStepView(BuildContext context, AppLocalizations l10n, String vehicleId, String shiftId, String shiftStatus) {
    if (_currentStep == 0) return _checklistStep(context, l10n);
    if (_currentStep == 1) return _photosStep(context, l10n);
    return _reviewStep(context, l10n, vehicleId, shiftId, shiftStatus);
  }

  Widget _checklistStep(BuildContext context, AppLocalizations l10n) {
    final semantic = context.semanticColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.t('checklist_items'), style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _checklistItems.length,
          itemBuilder: (context, index) {
            final item = _checklistItems[index];
            final isBad = _checks[item] == 'bad';
            return Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(item.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w600)),
                        Row(
                          children: [
                            ChoiceChip(
                              label: Text(l10n.t('good')),
                              selected: _checks[item] == 'good',
                              onSelected: (_) => setState(() {
                                _checks[item] = 'good';
                                _issuePhotos.remove(item);
                              }),
                            ),
                            const SizedBox(width: 8),
                            ChoiceChip(
                              label: Text(l10n.t('bad')),
                              selected: isBad,
                              selectedColor: semantic.statusBackground(semantic.danger, opacity: 0.35),
                              onSelected: (_) => setState(() => _checks[item] = 'bad'),
                            ),
                          ],
                        ),
                      ],
                    ),
                    if (isBad) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(l10n.t('photo_proof_required'), style: TextStyle(color: semantic.danger, fontSize: 12)),
                          const Spacer(),
                          IconButton(icon: const Icon(Icons.camera_alt), onPressed: () => _captureIssuePhoto(item)),
                        ],
                      ),
                      if (_issuePhotos[item] != null) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(_issuePhotos[item]!, height: 120, width: double.infinity, fit: BoxFit.cover),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            for (final entry in _checks.entries) {
              if (entry.value == 'bad' && _issuePhotos[entry.key] == null) {
                AppFeedback.show(
                  context,
                  message: l10n.t('bad_item_photo_required', {'item': entry.key}),
                  type: AppFeedbackType.warning,
                );
                return;
              }
            }
            setState(() => _currentStep = 1);
          },
          child: Text(l10n.t('continue_to_photos')),
        ),
      ],
    );
  }

  Widget _photosStep(BuildContext context, AppLocalizations l10n) {
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.t('directional_photos'), style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: _directions.length,
          itemBuilder: (context, index) {
            final direction = _directions[index];
            final file = _directionalPhotos[direction];
            return InkWell(
              onTap: () => _captureDirectionPhoto(direction),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                decoration: BoxDecoration(
                  color: scheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: file != null ? semantic.success : semantic.border),
                ),
                child: file != null
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(file, fit: BoxFit.cover),
                          ),
                          Positioned(
                            bottom: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(direction.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 10)),
                            ),
                          ),
                        ],
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.camera_alt, size: 36, color: semantic.muted),
                          const SizedBox(height: 8),
                          Text(direction.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w500)),
                        ],
                      ),
              ),
            );
          },
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(onPressed: () => setState(() => _currentStep = 0), child: Text(l10n.t('back_to_checklist'))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  if (_directionalPhotos.length < _directions.length) {
                    AppFeedback.show(context, message: l10n.t('all_directions_required'), type: AppFeedbackType.warning);
                    return;
                  }
                  setState(() => _currentStep = 2);
                },
                child: Text(l10n.t('review_submit')),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _reviewStep(BuildContext context, AppLocalizations l10n, String vehicleId, String shiftId, String shiftStatus) {
    final semantic = context.semanticColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.t('review_summary'), style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: _checklistItems.map((item) {
                final status = _checks[item];
                final ok = status == 'good';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(item.toUpperCase()),
                      Text(
                        ok ? l10n.t('good').toUpperCase() : l10n.t('bad').toUpperCase(),
                        style: TextStyle(color: ok ? semantic.success : semantic.danger, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _notesController,
          maxLines: 3,
          decoration: InputDecoration(labelText: l10n.t('additional_notes'), hintText: l10n.t('notes_hint')),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(onPressed: () => setState(() => _currentStep = 1), child: Text(l10n.t('back_to_photos'))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  context.read<InspectionCubit>().submitInspection(
                        shiftId: shiftId,
                        vehicleId: vehicleId,
                        type: shiftStatus == 'PendingVerification' ? 'pre' : 'post',
                        notes: _notesController.text,
                        checks: _checks,
                        directionalPhotos: _directionalPhotos,
                        issuePhotos: _issuePhotos,
                        optionalPhotos: const [],
                        isOnline: _isOnline,
                      );
                },
                child: Text(l10n.t('confirm_complete')),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
