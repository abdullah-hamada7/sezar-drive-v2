import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/fleet_shell.dart';
import '../cubit/auth_cubit.dart';

class IdentityVerificationScreen extends StatefulWidget {
  const IdentityVerificationScreen({super.key});

  @override
  State<IdentityVerificationScreen> createState() =>
      _IdentityVerificationScreenState();
}

class _IdentityVerificationScreenState
    extends State<IdentityVerificationScreen> {
  File? _identityPhoto;
  File? _idCardFront;
  File? _idCardBack;
  bool _isUploading = false;

  bool get _canSubmit =>
      _identityPhoto != null &&
      _idCardFront != null &&
      _idCardBack != null &&
      !_isUploading;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: FleetAppBar(
        title: l10n.t('identity_verification_title'),
        showBackButton: true,
      ),
      body: BlocListener<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthError) {
            AppFeedback.show(context,
                message: state.message, type: AppFeedbackType.error);
            if (mounted) setState(() => _isUploading = false);
          } else if (state is AuthAuthenticated) {
            AppFeedback.show(context,
                message: l10n.t('identity_submitted'),
                type: AppFeedbackType.success);
            Navigator.pop(context);
          }
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.verified_user, size: 64, color: scheme.primary),
              const SizedBox(height: 16),
              Text(l10n.t('identity_upload_title'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(l10n.t('identity_upload_body'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 24),
              _IdentityPhotoCard(
                title: l10n.t('driver_identity_photo'),
                file: _identityPhoto,
                onTap: () => _pickPhoto((photo) => _identityPhoto = photo),
                semantic: semantic,
                surfaceColor: scheme.surface,
              ),
              const SizedBox(height: 16),
              _IdentityPhotoCard(
                title: l10n.t('national_id_front'),
                file: _idCardFront,
                onTap: () => _pickPhoto((photo) => _idCardFront = photo),
                semantic: semantic,
                surfaceColor: scheme.surface,
              ),
              const SizedBox(height: 16),
              _IdentityPhotoCard(
                title: l10n.t('national_id_back'),
                file: _idCardBack,
                onTap: () => _pickPhoto((photo) => _idCardBack = photo),
                semantic: semantic,
                surfaceColor: scheme.surface,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _canSubmit ? _uploadIdentity : null,
                child: _isUploading
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(l10n.t('submit_verification')),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(l10n.t('skip_for_now'))),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickPhoto(ValueChanged<File> onSelected) async {
    try {
      final image = await ImagePicker()
          .pickImage(source: ImageSource.camera, imageQuality: 80);
      if (image != null && mounted) {
        setState(() => onSelected(File(image.path)));
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

  Future<void> _uploadIdentity() async {
    final l10n = AppLocalizations.of(context);
    if (_identityPhoto == null || _idCardFront == null || _idCardBack == null) {
      AppFeedback.show(
        context,
        message: l10n.t('identity_all_photos_required'),
        type: AppFeedbackType.warning,
      );
      return;
    }
    setState(() => _isUploading = true);
    await context.read<AuthCubit>().uploadIdentityPhoto(
          _identityPhoto!,
          idCardFront: _idCardFront!,
          idCardBack: _idCardBack!,
        );
    if (mounted) setState(() => _isUploading = false);
  }
}

class _IdentityPhotoCard extends StatelessWidget {
  final String title;
  final File? file;
  final VoidCallback onTap;
  final AppSemanticColors semantic;
  final Color surfaceColor;

  const _IdentityPhotoCard({
    required this.title,
    required this.file,
    required this.onTap,
    required this.semantic,
    required this.surfaceColor,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: onTap,
          child: Container(
            height: 180,
            decoration: BoxDecoration(
              color: surfaceColor,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: semantic.border),
            ),
            child: file != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.file(file!, fit: BoxFit.cover),
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.camera_alt, size: 44, color: semantic.muted),
                      const SizedBox(height: 12),
                      Text(
                        l10n.t('tap_to_photo'),
                        style: TextStyle(color: semantic.muted),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}
