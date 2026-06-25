import 'package:flutter_bloc/flutter_bloc.dart';
import 'dart:io';
import '../../../core/network/dio_client.dart';
import '../../../core/network/multipart_form.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

abstract class ShiftState {}

class ShiftInitial extends ShiftState {}

class ShiftLoading extends ShiftState {}

class ShiftLoaded extends ShiftState {
  final Shift? activeShift;

  /// True when the current shift has a completed inspection with all 6 directions.
  final bool preShiftInspectionComplete;
  ShiftLoaded(this.activeShift, {this.preShiftInspectionComplete = false});
}

class ShiftError extends ShiftState {
  final String message;
  ShiftError(this.message);
}

/// Emitted when activate is blocked because pre-shift inspection is incomplete.
class ShiftInspectionRequired extends ShiftState {
  final Shift activeShift;
  ShiftInspectionRequired(this.activeShift);
}

/// Emitted when close is blocked because post-shift inspection is missing.
class ShiftPostInspectionRequired extends ShiftState {
  final Shift activeShift;
  ShiftPostInspectionRequired(this.activeShift);
}

/// Emitted when close is blocked because a trip is still in progress.
class ShiftActiveTripBlocked extends ShiftState {
  final Shift activeShift;
  ShiftActiveTripBlocked(this.activeShift);
}

/// Emitted after shift is successfully activated — UI should navigate to trips.
class ShiftActivated extends ShiftState {}

class ShiftCubit extends Cubit<ShiftState> {
  final DioClient _client;

  static const requiredInspectionDirections = [
    'front',
    'back',
    'left',
    'right',
    'dashboard',
    'tank',
  ];

  ShiftCubit(this._client) : super(ShiftInitial());

  Shift? _cachedActiveShift;
  bool _cachedPreShiftInspectionComplete = false;

  /// Last known active shift — kept during background refresh so inspection UI
  /// does not reset while the camera or websocket triggers a silent reload.
  Shift? get cachedActiveShift => _cachedActiveShift;

  bool get cachedPreShiftInspectionComplete =>
      _cachedPreShiftInspectionComplete;

  Future<List<Map<String, dynamic>>> _fetchInspections(String shiftId) async {
    final response = await _client.dio.get(
      '/inspections',
      queryParameters: {'shiftId': shiftId},
    );
    final raw = response.data;
    final dataMap = parseResponseMap(raw);
    final inspections = raw is List
        ? raw
        : (dataMap['inspections'] is List
            ? dataMap['inspections'] as List
            : dataMap['data'] is List
                ? dataMap['data'] as List
                : const []);
    return inspections
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  bool _inspectionHasAllDirections(Map<String, dynamic> insp) {
    final status = (insp['status'] as String? ?? '').toLowerCase();
    if (status != 'completed') return false;

    final photos = insp['photos'] is List ? insp['photos'] as List : const [];
    final directions = photos
        .whereType<Map>()
        .map((p) => p['direction']?.toString())
        .whereType<String>()
        .toSet();

    return requiredInspectionDirections.every(directions.contains);
  }

  /// [after] — when set, only inspections created after this timestamp count (post-shift).
  Future<bool> _hasCompletedInspection(String shiftId,
      {DateTime? after}) async {
    try {
      final inspections = await _fetchInspections(shiftId);
      for (final insp in inspections) {
        if (!_inspectionHasAllDirections(insp)) continue;

        if (after != null) {
          final createdAtRaw = insp['createdAt']?.toString();
          if (createdAtRaw == null) continue;
          final createdAt = DateTime.tryParse(createdAtRaw);
          if (createdAt == null) continue;
          if (!createdAt.isAfter(after)) continue;
        }

        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _hasInProgressTrip() async {
    try {
      final response =
          await _client.dio.get('/trips', queryParameters: {'limit': 50});
      final dataMap = parseResponseMap(response.data);
      final items = dataMap['trips'] is List
          ? dataMap['trips'] as List
          : dataMap['data'] is List
              ? dataMap['data'] as List
              : const [];
      return items.whereType<Map>().any((t) => t['status'] == 'IN_PROGRESS');
    } catch (_) {
      return false;
    }
  }

  Future<void> fetchActiveShift({bool silent = false}) async {
    final previous =
        state is ShiftLoaded ? state as ShiftLoaded : null;
    if (!silent || previous == null) {
      if (previous == null) emit(ShiftLoading());
    }
    try {
      final response = await _client.dio.get('/shifts/active');
      final dataMap = parseResponseMap(response.data);
      final shiftData = dataMap['shift'];
      if (shiftData == null) {
        _cachedActiveShift = null;
        _cachedPreShiftInspectionComplete = false;
        emit(ShiftLoaded(null));
      } else {
        if (shiftData is! Map) {
          emit(ShiftError('Unexpected active shift response.'));
          return;
        }
        final shift = Shift.fromJson(Map<String, dynamic>.from(shiftData));
        final inspectionComplete = shift.status == 'PendingVerification'
            ? await _hasCompletedInspection(shift.id)
            : false;
        _cachedActiveShift = shift;
        _cachedPreShiftInspectionComplete = inspectionComplete;
        emit(
          ShiftLoaded(shift, preShiftInspectionComplete: inspectionComplete),
        );
      }
    } catch (e) {
      if (previous != null) {
        emit(previous);
      } else if (_cachedActiveShift != null) {
        emit(
          ShiftLoaded(
            _cachedActiveShift,
            preShiftInspectionComplete: _cachedPreShiftInspectionComplete,
          ),
        );
      } else {
        emit(ShiftError(apiError(e)));
      }
    }
  }

  Future<void> startShift() async {
    emit(ShiftLoading());
    try {
      await _client.dio.post('/shifts');
      await fetchActiveShift(silent: true);
    } catch (e) {
      emit(ShiftError(apiError(e, fallback: 'Failed to start shift.')));
    }
  }

  Future<void> verifyFace(File selfieFile) async {
    emit(ShiftLoading());
    try {
      final bytes = await selfieFile.readAsBytes();
      final formData = buildMultipartForm(
        files: {
          'photo': jpegMultipartFromBytes(
            bytes,
            filename: 'selfie_${DateTime.now().millisecondsSinceEpoch}.jpg',
          ),
        },
      );
      await _client.dio.post('/verify/shift-selfie', data: formData);
      await fetchActiveShift(silent: true);
    } catch (e) {
      emit(ShiftError(apiError(e, fallback: 'Face verification failed.')));
    }
  }

  Future<void> scanQRAndAssignVehicle(String qrCode) async {
    emit(ShiftLoading());
    try {
      await _client.dio.post('/vehicles/scan-qr', data: {'qrCode': qrCode});
      await fetchActiveShift(silent: true);
    } catch (e) {
      emit(ShiftError(apiError(e, fallback: 'QR vehicle assignment failed.')));
    }
  }

  Future<void> activateShift(String shiftId) async {
    final current = state;
    Shift? shift;
    if (current is ShiftLoaded) {
      shift = current.activeShift;
    }

    emit(ShiftLoading());

    final inspectionComplete = await _hasCompletedInspection(shiftId);
    if (!inspectionComplete) {
      if (shift != null) {
        emit(ShiftInspectionRequired(shift));
      } else {
        emit(ShiftError(
            'Complete vehicle inspection (6 photos) before activating.'));
      }
      return;
    }

    try {
      await _client.dio.put('/shifts/$shiftId/activate');
      emit(ShiftActivated());
      await fetchActiveShift(silent: true);
    } catch (e) {
      emit(ShiftError(apiError(e, fallback: 'Failed to activate shift.')));
    }
  }

  Future<void> closeShift(Shift shift) async {
    emit(ShiftLoading());

    if (shift.startedAt != null) {
      final hasPostInspection = await _hasCompletedInspection(
        shift.id,
        after: shift.startedAt,
      );
      if (!hasPostInspection) {
        emit(ShiftPostInspectionRequired(shift));
        return;
      }
    }

    if (await _hasInProgressTrip()) {
      emit(ShiftActiveTripBlocked(shift));
      return;
    }

    try {
      await _client.dio.put('/shifts/${shift.id}/close');
      await fetchActiveShift(silent: true);
    } catch (e) {
      emit(ShiftError(apiError(e, fallback: 'Failed to close shift.')));
    }
  }

  /// Re-emit loaded state after a blocked action.
  void restoreLoaded(Shift shift, {required bool preShiftInspectionComplete}) {
    _cachedActiveShift = shift;
    _cachedPreShiftInspectionComplete = preShiftInspectionComplete;
    emit(ShiftLoaded(shift,
        preShiftInspectionComplete: preShiftInspectionComplete));
  }
}
