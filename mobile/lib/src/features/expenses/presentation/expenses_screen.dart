import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/domain/driver_models.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/theme/app_status.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/connectivity_service.dart';
import '../../../core/services/tab_badge_service.dart';
import '../../../core/widgets/app_feedback.dart';
import '../../../core/widgets/empty_state_panel.dart';
import '../../../core/widgets/list_loading_skeleton.dart';
import '../../badges/cubit/badge_cubit.dart';
import '../../shift/cubit/shift_cubit.dart';
import '../cubit/expense_cubit.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  final _amountController = TextEditingController();
  final _descController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String? _selectedCategoryId;
  String? _selectedTripId;
  File? _receiptFile;
  bool _isOnline = true;
  StreamSubscription<bool>? _connSub;

  @override
  void initState() {
    super.initState();
    context.read<ExpenseCubit>().fetchExpensesAndCategories();
    _markTabViewed();
    _connSub =
        GetIt.I<ConnectivityService>().onConnectivityChanged.listen((online) {
      if (mounted) setState(() => _isOnline = online);
    });
    GetIt.I<ConnectivityService>().checkNow().then((online) {
      if (mounted) setState(() => _isOnline = online);
    });
  }

  Future<void> _markTabViewed() async {
    try {
      await GetIt.I<TabBadgeService>().markTabViewed('expenses');
      if (mounted) context.read<BadgeCubit>().fetchCounts();
    } catch (_) {}
  }

  @override
  void dispose() {
    _connSub?.cancel();
    _amountController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _pickReceipt() async {
    final image = await ImagePicker()
        .pickImage(source: ImageSource.camera, imageQuality: 70);
    if (image != null) setState(() => _receiptFile = File(image.path));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final shiftState = context.watch<ShiftCubit>().state;
    final hasActiveShift =
        shiftState is ShiftLoaded && shiftState.activeShift != null;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('expenses_log'))),
      body: BlocConsumer<ExpenseCubit, ExpenseState>(
        listener: (context, state) {
          if (state is ExpenseSuccess) {
            AppFeedback.show(
              context,
              message: state.isOffline
                  ? l10n.t('expense_queued')
                  : l10n.t('expense_logged'),
              type: AppFeedbackType.success,
            );
            _amountController.clear();
            _descController.clear();
            setState(() {
              _receiptFile = null;
              _selectedTripId = null;
              _selectedCategoryId = null;
            });
            context.read<ExpenseCubit>().fetchExpensesAndCategories();
          } else if (state is ExpenseError) {
            AppFeedback.show(context,
                message: state.message, type: AppFeedbackType.error);
          }
        },
        builder: (context, state) {
          if (state is ExpenseLoading) {
            return const ListLoadingSkeleton(itemCount: 4, itemHeight: 72);
          }

          if (state is ExpenseLoaded) {
            return Column(
              children: [
                if (!hasActiveShift)
                  SemanticBanner(
                    message: l10n.t('shift_required_expense'),
                    icon: Icons.warning_amber_outlined,
                    background: context.semanticColors.warning,
                    foreground: AppTheme.backgroundColor,
                  ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (hasActiveShift) ...[
                        _buildExpenseForm(
                          context,
                          l10n,
                          shiftState.activeShift!.id,
                          state.categories,
                          state.acceptedTrips,
                        ),
                        const SizedBox(height: 24),
                        const Divider(height: 1),
                        const SizedBox(height: 16),
                      ],
                      Text(l10n.t('recent_expenses'),
                          style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: 12),
                      if (state.expenses.isEmpty)
                        EmptyStatePanel(
                          icon: Icons.receipt_long_outlined,
                          title: l10n.t('no_expenses'),
                          message: l10n.t('no_expenses_hint'),
                        )
                      else
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: state.expenses.length,
                          itemBuilder: (context, index) {
                            final exp = state.expenses[index];
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(Icons.receipt_long,
                                  color: context.semanticColors.warning),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      exp.description ??
                                          l10n.t('no_description'),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  _ExpenseStatusBadge(status: exp.status),
                                ],
                              ),
                              subtitle: Text(exp.category?.name ??
                                  l10n.t('general_category')),
                              trailing: Text(
                                '${exp.amount.toStringAsFixed(2)} EGP',
                                style: Theme.of(context).textTheme.labelLarge,
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ],
            );
          }

          return EmptyStatePanel(
            icon: Icons.error_outline,
            title: l10n.t('load_failed_expenses'),
            actionLabel: l10n.t('retry'),
            onAction: () =>
                context.read<ExpenseCubit>().fetchExpensesAndCategories(),
          );
        },
      ),
    );
  }

  String _tripLabel(Trip trip) {
    final passenger = trip.passengers != null && trip.passengers!.isNotEmpty
        ? ' (${trip.passengers!.first.name})'
        : '';
    return '${trip.pickupLocation} → ${trip.dropoffLocation}$passenger';
  }

  Widget _buildExpenseForm(
    BuildContext context,
    AppLocalizations l10n,
    String shiftId,
    List<ExpenseCategory> categories,
    List<Trip> acceptedTrips,
  ) {
    final semantic = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;

    if (acceptedTrips.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: semantic.statusBackground(semantic.warning),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: semantic.warning.withValues(alpha: 0.4)),
        ),
        child: Column(
          children: [
            Icon(Icons.info_outline, color: semantic.warning, size: 36),
            const SizedBox(height: 12),
            Text(l10n.t('no_accepted_trips'),
                style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(l10n.t('no_accepted_trips_hint'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      );
    }

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DropdownButtonFormField<String>(
            initialValue: _selectedTripId,
            decoration: InputDecoration(labelText: l10n.t('linked_trip')),
            items: acceptedTrips
                .map((trip) => DropdownMenuItem(
                    value: trip.id,
                    child: Text(_tripLabel(trip),
                        overflow: TextOverflow.ellipsis)))
                .toList(),
            onChanged: (val) => setState(() => _selectedTripId = val),
            validator: (value) =>
                value == null ? l10n.t('select_trip_required') : null,
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _selectedCategoryId,
            decoration: InputDecoration(labelText: l10n.t('expense_category')),
            items: categories
                .map((cat) =>
                    DropdownMenuItem(value: cat.id, child: Text(cat.name)))
                .toList(),
            onChanged: (val) => setState(() => _selectedCategoryId = val),
            validator: (value) =>
                value == null ? l10n.t('select_category_required') : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
                labelText: l10n.t('amount_usd'),
                prefixIcon: const Icon(Icons.attach_money)),
            validator: (value) {
              if (value == null || value.isEmpty) return l10n.t('enter_amount');
              if (double.tryParse(value) == null) {
                return l10n.t('invalid_amount');
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _descController,
            decoration: InputDecoration(
                labelText: l10n.t('description_purpose'),
                prefixIcon: const Icon(Icons.description)),
            validator: (value) => value == null || value.isEmpty
                ? l10n.t('enter_description')
                : null,
          ),
          const SizedBox(height: 16),
          _receiptFile != null
              ? Stack(
                  alignment: Alignment.topRight,
                  children: [
                    Container(
                      height: 120,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: semantic.success),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.file(_receiptFile!, fit: BoxFit.cover),
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Material(
                        color: Colors.black54,
                        shape: const CircleBorder(),
                        child: InkWell(
                          onTap: () => setState(() => _receiptFile = null),
                          customBorder: const CircleBorder(),
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(Icons.close,
                                color: Colors.white, size: 18),
                          ),
                        ),
                      ),
                    ),
                  ],
                )
              : InkWell(
                  onTap: _pickReceipt,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 120,
                    decoration: BoxDecoration(
                      color: scheme.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: semantic.border),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.camera_alt, size: 32, color: semantic.muted),
                        const SizedBox(height: 8),
                        Text(l10n.t('capture_receipt'),
                            style: TextStyle(color: semantic.muted)),
                      ],
                    ),
                  ),
                ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              if (_formKey.currentState!.validate()) {
                context.read<ExpenseCubit>().submitExpense(
                      shiftId: shiftId,
                      tripId: _selectedTripId!,
                      categoryId: _selectedCategoryId!,
                      amount: double.parse(_amountController.text),
                      description: _descController.text,
                      receiptFile: _receiptFile,
                      isOnline: _isOnline,
                    );
              }
            },
            child: Text(l10n.t('log_expense')),
          ),
        ],
      ),
    );
  }
}

class _ExpenseStatusBadge extends StatelessWidget {
  final String status;
  const _ExpenseStatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final color = AppStatus.expenseStatusColor(context, status);
    final normalized = status.toLowerCase();
    final label = normalized == 'approved'
        ? l10n.t('approved')
        : normalized == 'rejected'
            ? l10n.t('rejected')
            : l10n.t('pending');

    return StatusChip(label: label, color: color);
  }
}
