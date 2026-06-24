import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_feedback.dart';
import '../cubit/password_reset_cubit.dart';

class PasswordResetScreen extends StatefulWidget {
  const PasswordResetScreen({super.key});

  @override
  State<PasswordResetScreen> createState() => _PasswordResetScreenState();
}

class _PasswordResetScreenState extends State<PasswordResetScreen> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  int _step = 0;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('account_recovery'))),
      body: BlocConsumer<PasswordResetCubit, PasswordResetState>(
        listener: (context, state) {
          if (state is PasswordResetCodeSent) {
            setState(() => _step = 1);
          } else if (state is PasswordResetCodeVerified) {
            setState(() => _step = 2);
          } else if (state is PasswordResetSuccess) {
            AppFeedback.show(context, message: l10n.t('password_reset_success'), type: AppFeedbackType.success);
            Navigator.pop(context);
          } else if (state is PasswordResetError) {
            AppFeedback.show(context, message: state.message, type: AppFeedbackType.error);
          }
        },
        builder: (context, state) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 24),
                  _buildStepIndicator(context, l10n),
                  const SizedBox(height: 32),
                  if (_step == 0) _buildEmailStep(context, l10n, state),
                  if (_step == 1) _buildCodeStep(context, l10n, state),
                  if (_step == 2) _buildResetStep(context, l10n, state),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildStepIndicator(BuildContext context, AppLocalizations l10n) {
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    return Row(
      children: List.generate(3, (i) {
        final isActive = i == _step;
        final isDone = i < _step;
        return Expanded(
          child: Row(
            children: [
              if (i > 0)
                Expanded(
                  child: Container(height: 2, color: isDone ? semantic.success : semantic.border),
                ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isDone ? semantic.success : (isActive ? scheme.primary : semantic.border),
                ),
                child: Center(
                  child: isDone
                      ? const Icon(Icons.check, size: 18, color: Colors.white)
                      : Text('${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ),
              if (i < 2)
                Expanded(
                  child: Container(height: 2, color: isDone ? semantic.success : semantic.border),
                ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildEmailStep(BuildContext context, AppLocalizations l10n, PasswordResetState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.t('recovery_step_email'), style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(l10n.t('recovery_email_intro'), style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 24),
        TextFormField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          textCapitalization: TextCapitalization.none,
          decoration: InputDecoration(labelText: l10n.t('email_address'), prefixIcon: const Icon(Icons.email_outlined)),
          validator: (v) => v == null || v.trim().isEmpty ? l10n.t('enter_email') : null,
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: state is PasswordResetLoading
              ? null
              : () {
                  if (_formKey.currentState!.validate()) {
                    context.read<PasswordResetCubit>().requestRescue(_emailController.text);
                  }
                },
          child: state is PasswordResetLoading
              ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(l10n.t('send_recovery_code')),
        ),
      ],
    );
  }

  Widget _buildCodeStep(BuildContext context, AppLocalizations l10n, PasswordResetState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.t('recovery_step_verify'), style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(l10n.t('recovery_code_intro', {'email': _emailController.text}), style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 24),
        TextFormField(
          controller: _codeController,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: l10n.t('recovery_code'), prefixIcon: const Icon(Icons.pin_outlined)),
          validator: (v) => v == null || v.isEmpty ? l10n.t('enter_recovery_code') : null,
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: state is PasswordResetLoading
              ? null
              : () {
                  if (_formKey.currentState!.validate()) {
                    context.read<PasswordResetCubit>().verifyRescueCode(_emailController.text, _codeController.text);
                  }
                },
          child: state is PasswordResetLoading
              ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(l10n.t('verify_code')),
        ),
      ],
    );
  }

  Widget _buildResetStep(BuildContext context, AppLocalizations l10n, PasswordResetState state) {
    final muted = context.semanticColors.muted;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.t('set_new_password'), style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(l10n.t('set_password_intro'), style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 24),
        TextFormField(
          controller: _passwordController,
          obscureText: _obscureNewPassword,
          autocorrect: false,
          textCapitalization: TextCapitalization.none,
          decoration: InputDecoration(
            labelText: l10n.t('new_password'),
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_obscureNewPassword ? Icons.visibility_off : Icons.visibility, color: muted),
              onPressed: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
            ),
          ),
          validator: (v) {
            if (v == null || v.isEmpty) return l10n.t('validation_password');
            if (v.length < 8) return l10n.t('password_min_length');
            return null;
          },
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _confirmPasswordController,
          obscureText: _obscureConfirmPassword,
          autocorrect: false,
          textCapitalization: TextCapitalization.none,
          decoration: InputDecoration(
            labelText: l10n.t('confirm_new_password'),
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility, color: muted),
              onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
            ),
          ),
          validator: (v) => v != _passwordController.text ? l10n.t('passwords_no_match') : null,
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: state is PasswordResetLoading
              ? null
              : () {
                  if (_formKey.currentState!.validate()) {
                    final resetState = context.read<PasswordResetCubit>().state;
                    if (resetState is PasswordResetCodeVerified) {
                      context.read<PasswordResetCubit>().resetPassword(resetState.resetToken, _passwordController.text);
                    }
                  }
                },
          child: state is PasswordResetLoading
              ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(l10n.t('reset_password')),
        ),
      ],
    );
  }
}
