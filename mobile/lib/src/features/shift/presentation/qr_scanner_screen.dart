import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/utils/qr_normalizer.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/theme/app_status.dart';
import '../../../core/widgets/fleet_shell.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../auth/presentation/identity_verification_screen.dart';

class QrScannerScreen extends StatefulWidget {
  final void Function(String code) onScanned;
  const QrScannerScreen({super.key, required this.onScanned});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    final raw = barcodes.first.rawValue;
    if (raw == null || raw.trim().isEmpty) return;
    _handled = true;
    widget.onScanned(normalizeScannedQrValue(raw.trim()));
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: FleetAppBar(
        title: l10n.t('scan_vehicle_qr_title'),
        showBackButton: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                l10n.t('scan_vehicle_qr_hint'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DriverDetailsSheet extends StatelessWidget {
  final User user;
  const DriverDetailsSheet({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final semantic = context.semanticColors;
    final hasIdentityDocuments =
        (user.idCardFront?.trim().isNotEmpty ?? false) ||
            (user.idCardBack?.trim().isNotEmpty ?? false);
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundImage: user.avatarUrl != null
                      ? NetworkImage(user.avatarUrl!)
                      : null,
                  child: user.avatarUrl == null
                      ? const Icon(Icons.person, size: 32)
                      : null,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.name,
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.w600)),
                      Text(user.email, style: TextStyle(color: semantic.muted)),
                      const SizedBox(height: 4),
                      StatusChip(
                        label: user.identityVerified
                            ? l10n.t('verified')
                            : l10n.t('pending_verification'),
                        color: user.identityVerified
                            ? semantic.success
                            : semantic.warning,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _DetailRow(label: l10n.t('phone'), value: user.phone),
            if (user.licenseNumber != null)
              _DetailRow(label: l10n.t('license'), value: user.licenseNumber!),
            if (hasIdentityDocuments) ...[
              const SizedBox(height: 16),
              Text(
                l10n.t('identity_documents'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _IdentityDocumentPreview(
                      title: l10n.t('national_id_front'),
                      imageUrl: user.idCardFront,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _IdentityDocumentPreview(
                      title: l10n.t('national_id_back'),
                      imageUrl: user.idCardBack,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            if (!user.identityVerified)
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const IdentityVerificationScreen()),
                  );
                },
                icon: const Icon(Icons.verified_user),
                label: Text(l10n.t('upload_identity')),
              ),
            OutlinedButton(
              onPressed: () => _showChangePasswordDialog(context),
              child: Text(l10n.t('change_password')),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: Text(l10n.t('close')),
            ),
          ],
        ),
      ),
    );
  }

  void _showChangePasswordDialog(BuildContext context) {
    final currentController = TextEditingController();
    final newController = TextEditingController();
    showDialog(
      context: context,
      builder: (dialogCtx) {
        final l10n = AppLocalizations.of(context);
        return AlertDialog(
          title: Text(l10n.t('change_password')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: currentController,
                obscureText: true,
                decoration:
                    InputDecoration(labelText: l10n.t('current_password')),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: newController,
                obscureText: true,
                decoration: InputDecoration(labelText: l10n.t('new_password')),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(dialogCtx),
                child: Text(l10n.t('cancel'))),
            ElevatedButton(
              onPressed: () {
                final current = currentController.text.trim();
                final newPass = newController.text.trim();
                if (current.isNotEmpty && newPass.length >= 8) {
                  Navigator.pop(dialogCtx);
                  context.read<AuthCubit>().changePassword(
                        newPass,
                        currentPassword: current,
                      );
                }
              },
              child: Text(l10n.t('save')),
            ),
          ],
        );
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final muted = context.semanticColors.muted;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
              width: 100, child: Text(label, style: TextStyle(color: muted))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _IdentityDocumentPreview extends StatelessWidget {
  final String title;
  final String? imageUrl;

  const _IdentityDocumentPreview({
    required this.title,
    required this.imageUrl,
  });

  @override
  Widget build(BuildContext context) {
    final semantic = context.semanticColors;
    final hasImage = imageUrl != null && imageUrl!.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: Container(
              color: semantic.statusBackground(semantic.muted, opacity: 0.12),
              child: hasImage
                  ? Image.network(
                      imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Icon(
                        Icons.broken_image_outlined,
                        color: semantic.muted,
                      ),
                    )
                  : Icon(Icons.image_not_supported_outlined,
                      color: semantic.muted),
            ),
          ),
        ),
      ],
    );
  }
}
