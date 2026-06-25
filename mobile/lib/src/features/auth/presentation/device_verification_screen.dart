import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/fleet_shell.dart';
import '../cubit/auth_cubit.dart';

class DeviceVerificationScreen extends StatefulWidget {
  final String userId;
  final String verificationToken;
  final String? bannerMessage;
  final bool isVerifying;

  const DeviceVerificationScreen({
    super.key,
    required this.userId,
    required this.verificationToken,
    this.bannerMessage,
    this.isVerifying = false,
  });

  @override
  State<DeviceVerificationScreen> createState() =>
      _DeviceVerificationScreenState();
}

class _DeviceVerificationScreenState extends State<DeviceVerificationScreen> {
  bool _isCapturing = false;
  String? _shownBanner;

  @override
  void initState() {
    super.initState();
    _scheduleBanner(widget.bannerMessage);
  }

  @override
  void didUpdateWidget(covariant DeviceVerificationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.bannerMessage != oldWidget.bannerMessage) {
      _scheduleBanner(widget.bannerMessage);
    }
  }

  void _scheduleBanner(String? message) {
    if (message == null || message.isEmpty || message == _shownBanner) return;
    _shownBanner = message;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      AppFeedback.show(context, message: message, type: AppFeedbackType.error);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;

    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        final verifying =
            widget.isVerifying || state is AuthVerifyingDevice || _isCapturing;
        final token = state is AuthDeviceUnverified
            ? state.verificationToken
            : state is AuthVerifyingDevice
                ? state.verificationToken
                : widget.verificationToken;
        final userId = state is AuthDeviceUnverified
            ? state.userId
            : state is AuthVerifyingDevice
                ? state.userId
                : widget.userId;

        return Scaffold(
          appBar: FleetAppBar(
            title: l10n.t('new_device_title'),
            leading: verifying
                ? null
                : IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () =>
                        context.read<AuthCubit>().cancelDeviceVerification(),
                  ),
          ),
          body: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.face_retouching_natural,
                    size: 72, color: scheme.primary),
                const SizedBox(height: 16),
                Text(
                  l10n.t('new_device_title'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.t('new_device_message'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: semantic.muted),
                ),
                const SizedBox(height: 24),
                _StepRow(
                  number: '1',
                  label: l10n.t('capture_selfie_btn'),
                  active: !verifying,
                ),
                _StepRow(
                  number: '2',
                  label: l10n.t('password_change_required'),
                  active: false,
                ),
                _StepRow(
                  number: '3',
                  label: l10n.t('dashboard'),
                  active: false,
                ),
                const Spacer(),
                if (verifying) ...[
                  const Center(child: CircularProgressIndicator()),
                  const SizedBox(height: 16),
                  Text(
                    state is AuthVerifyingDevice
                        ? l10n.t('submit_verification')
                        : l10n.t('tap_to_photo'),
                    textAlign: TextAlign.center,
                    style: TextStyle(color: semantic.muted),
                  ),
                ] else ...[
                  ElevatedButton.icon(
                    onPressed: () => _captureAndVerify(userId, token),
                    icon: const Icon(Icons.camera_front),
                    label: Text(l10n.t('capture_selfie_btn')),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () =>
                        context.read<AuthCubit>().cancelDeviceVerification(),
                    child: Text(l10n.t('cancel')),
                  ),
                ],
                const Spacer(),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _captureAndVerify(
      String userId, String verificationToken) async {
    setState(() => _isCapturing = true);
    try {
      final xFile = await ImagePicker().pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 70,
      );
      if (!mounted) return;
      if (xFile == null) {
        AppFeedback.show(
          context,
          message: AppLocalizations.of(context).t('selfie_cancelled'),
          type: AppFeedbackType.error,
        );
        return;
      }
      await context.read<AuthCubit>().verifyDevice(
            userId,
            verificationToken,
            xFile,
          );
    } catch (e) {
      if (mounted) {
        AppFeedback.show(
          context,
          message: 'Camera error: $e',
          type: AppFeedbackType.error,
        );
      }
    } finally {
      if (mounted) setState(() => _isCapturing = false);
    }
  }
}

class _StepRow extends StatelessWidget {
  final String number;
  final String label;
  final bool active;

  const _StepRow({
    required this.number,
    required this.label,
    required this.active,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor:
                active ? scheme.primary : scheme.surfaceContainerHighest,
            child: Text(
              number,
              style: TextStyle(
                color: active ? scheme.onPrimary : scheme.onSurfaceVariant,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(label)),
        ],
      ),
    );
  }
}
