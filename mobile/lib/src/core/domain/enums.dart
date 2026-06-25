import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum ShiftStatus {
  pendingVerification('PendingVerification'),
  active('Active'),
  closed('Closed'),
  unknown('Unknown');

  final String value;
  const ShiftStatus(this.value);

  factory ShiftStatus.fromString(String? value) {
    return ShiftStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => ShiftStatus.unknown,
    );
  }

  Color get color {
    switch (this) {
      case ShiftStatus.pendingVerification:
        return AppTheme.warningColor;
      case ShiftStatus.active:
        return AppTheme.successColor;
      case ShiftStatus.closed:
        return AppTheme.textMutedColor;
      case ShiftStatus.unknown:
        return AppTheme.textMutedColor;
    }
  }

  String get displayName {
    switch (this) {
      case ShiftStatus.pendingVerification:
        return 'Pending Verification';
      case ShiftStatus.active:
        return 'Active';
      case ShiftStatus.closed:
        return 'Closed';
      case ShiftStatus.unknown:
        return 'Unknown';
    }
  }
}

enum TripStatus {
  pending('Pending'),
  accepted('ACCEPTED'),
  inProgress('IN_PROGRESS'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  rejected('REJECTED'),
  unknown('Unknown');

  final String value;
  const TripStatus(this.value);

  factory TripStatus.fromString(String? value) {
    return TripStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => TripStatus.unknown,
    );
  }

  Color get color {
    switch (this) {
      case TripStatus.pending:
        return AppTheme.primaryColor;
      case TripStatus.accepted:
        return AppTheme.warningColor;
      case TripStatus.inProgress:
        return AppTheme.successColor;
      case TripStatus.completed:
        return AppTheme.textMutedColor;
      case TripStatus.cancelled:
        return AppTheme.dangerColor;
      case TripStatus.rejected:
        return AppTheme.warningColor;
      case TripStatus.unknown:
        return AppTheme.textMutedColor;
    }
  }
}

enum ExpenseStatus {
  pending('PENDING'),
  approved('APPROVED'),
  rejected('REJECTED'),
  unknown('Unknown');

  final String value;
  const ExpenseStatus(this.value);

  factory ExpenseStatus.fromString(String? value) {
    return ExpenseStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => ExpenseStatus.unknown,
    );
  }
}

enum DamageStatus {
  pending('PENDING'),
  reviewed('REVIEWED'),
  resolved('RESOLVED'),
  unknown('Unknown');

  final String value;
  const DamageStatus(this.value);

  factory DamageStatus.fromString(String? value) {
    return DamageStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => DamageStatus.unknown,
    );
  }
}

enum InspectionStatus {
  pending('PENDING'),
  inProgress('IN_PROGRESS'),
  completed('COMPLETED'),
  unknown('Unknown');

  final String value;
  const InspectionStatus(this.value);

  factory InspectionStatus.fromString(String? value) {
    return InspectionStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => InspectionStatus.unknown,
    );
  }
}

enum PaymentMethod {
  cash('CASH'),
  card('CARD'),
  online('ONLINE'),
  unknown('Unknown');

  final String value;
  const PaymentMethod(this.value);

  factory PaymentMethod.fromString(String? value) {
    return PaymentMethod.values.firstWhere(
      (e) => e.value == value,
      orElse: () => PaymentMethod.unknown,
    );
  }
}
