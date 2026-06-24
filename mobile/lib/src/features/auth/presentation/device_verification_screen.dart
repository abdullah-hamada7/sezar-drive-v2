import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_feedback.dart';
import '../cubit/auth_cubit.dart';

class DeviceVerificationScreen extends StatefulWidget {
  final String userId;
  final String verificationToken;
  final bool isVerifying;

  const DeviceVerificationScreen({
    super.key,
    required this.userId,
    required this.verificationToken,
    this.isVerifying = false,
  });

  @override
  State<DeviceVerificationScreen> createState() => _DeviceVerificationScreenState();
}

class _DeviceVerificationScreenState extends State<DeviceVerificationScreen> {
  bool _isCapturing = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;
    final busy = widget.isVerifying || _isCapturing;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('new_device_title')),
        leading: busy
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.read<AuthCubit>().cancelDeviceVerification(),
              ),
      ),
      body: BlocListener<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthDeviceUnverified && state.bannerMessage != null) {
            AppFeedback.show(context, message: state.bannerMessage!, type: AppFeedbackType.error);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.face_retouching_natural, size: 72, color: scheme.primary),
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
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: semantic.muted),
              ),
              const Spacer(),
              if (busy) ...[
                const Center(child: CircularProgressIndicator()),
                const SizedBox(height: 16),
                Text(
                  widget.isVerifying ? l10n.t('submit_verification') : l10n.t('tap_to_photo'),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: semantic.muted),
                ),
              ] else ...[
                ElevatedButton.icon(
                  onPressed: _captureAndVerify,
                  icon: const Icon(Icons.camera_front),
                  label: Text(l10n.t('capture_selfie_btn')),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => context.read<AuthCubit>().cancelDeviceVerification(),
                  child: Text(l10n.t('cancel')),
                ),
              ],
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _captureAndVerify() async {
    setState(() => _isCapturing = true);
    try {
      final xFile = await ImagePicker().pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 70,
      );
      if (!mounted) return;
      if (xFile == null) {
        setState(() => _isCapturing = false);
        AppFeedback.show(
          context,
          message: AppLocalizations.of(context).t('selfie_cancelled'),
          type: AppFeedbackType.error,
        );
        return;
      }
      await context.read<AuthCubit>().verifyDevice(
            widget.userId,
            widget.verificationToken,
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
