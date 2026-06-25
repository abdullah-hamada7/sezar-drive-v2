import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_feedback.dart';
import '../cubit/auth_cubit.dart';

class MustChangePasswordScreen extends StatefulWidget {
  final String? bannerMessage;
  const MustChangePasswordScreen({super.key, this.bannerMessage});

  @override
  State<MustChangePasswordScreen> createState() =>
      _MustChangePasswordScreenState();
}

class _MustChangePasswordScreenState extends State<MustChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();
    if (widget.bannerMessage != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AppFeedback.show(
          context,
          message: widget.bannerMessage!,
          type: AppFeedbackType.error,
        );
      });
    }
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool get _needsCurrentPassword {
    final cubit = context.read<AuthCubit>();
    return !cubit.hasPendingLoginPassword;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('password_change_required')),
        automaticallyImplyLeading: false,
      ),
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthMustChangePassword && state.bannerMessage != null) {
            AppFeedback.show(context,
                message: state.bannerMessage!, type: AppFeedbackType.error);
          }
        },
        builder: (context, state) {
          final loading = state is AuthLoading;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.lock_reset,
                      size: 72, color: theme.colorScheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    l10n.t('password_change_required'),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.t('password_change_intro'),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: context.semanticColors.muted,
                    ),
                  ),
                  const SizedBox(height: 32),
                  if (_needsCurrentPassword) ...[
                    TextFormField(
                      controller: _currentPasswordController,
                      obscureText: _obscureCurrent,
                      decoration: InputDecoration(
                        labelText: l10n.t('password'),
                        suffixIcon: IconButton(
                          icon: Icon(_obscureCurrent
                              ? Icons.visibility_off
                              : Icons.visibility),
                          onPressed: () => setState(
                              () => _obscureCurrent = !_obscureCurrent),
                        ),
                      ),
                      validator: (v) => (v == null || v.isEmpty)
                          ? l10n.t('validation_password')
                          : null,
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextFormField(
                    controller: _newPasswordController,
                    obscureText: _obscureNew,
                    decoration: InputDecoration(
                      labelText: l10n.t('new_password'),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureNew
                            ? Icons.visibility_off
                            : Icons.visibility),
                        onPressed: () =>
                            setState(() => _obscureNew = !_obscureNew),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) {
                        return l10n.t('validation_password');
                      }
                      if (v.length < 8) return l10n.t('password_min_length');
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirm,
                    decoration: InputDecoration(
                      labelText: l10n.t('confirm_new_password'),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureConfirm
                            ? Icons.visibility_off
                            : Icons.visibility),
                        onPressed: () =>
                            setState(() => _obscureConfirm = !_obscureConfirm),
                      ),
                    ),
                    validator: (v) {
                      if (v != _newPasswordController.text) {
                        return l10n.t('passwords_no_match');
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: loading
                        ? null
                        : () {
                            if (!_formKey.currentState!.validate()) return;
                            final cubit = context.read<AuthCubit>();
                            cubit.changePassword(
                              _newPasswordController.text.trim(),
                              currentPassword: _needsCurrentPassword
                                  ? _currentPasswordController.text
                                  : null,
                            );
                          },
                    child: loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : Text(l10n.t('save')),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: loading
                        ? null
                        : () => context.read<AuthCubit>().logout(),
                    child: Text(l10n.t('cancel')),
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
