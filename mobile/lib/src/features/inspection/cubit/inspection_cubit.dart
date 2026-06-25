import 'dart:convert';
import 'dart:io';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/multipart_form.dart';
import '../../../core/services/offline_sync_service.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

class InspectionDraft {
  final String shiftId;
  final int currentStep;
  final Map<String, String> checks;
  final Map<String, String> directionalPhotoPaths;
  final Map<String, String> issuePhotoPaths;
  final String notes;

  const InspectionDraft({
    required this.shiftId,
    required this.currentStep,
    required this.checks,
    required this.directionalPhotoPaths,
    required this.issuePhotoPaths,
    required this.notes,
  });

  Map<String, dynamic> toJson() => {
        'shiftId': shiftId,
        'currentStep': currentStep,
        'checks': checks,
        'directionalPhotoPaths': directionalPhotoPaths,
        'issuePhotoPaths': issuePhotoPaths,
        'notes': notes,
      };

  factory InspectionDraft.fromJson(Map<String, dynamic> json) {
    return InspectionDraft(
      shiftId: (json['shiftId'] ?? '').toString(),
      currentStep: parseIntWithDefault(json['currentStep'], 0),
      checks: _stringMap(json['checks']),
      directionalPhotoPaths: _stringMap(json['directionalPhotoPaths']),
      issuePhotoPaths: _stringMap(json['issuePhotoPaths']),
      notes: (json['notes'] ?? '').toString(),
    );
  }

  static Map<String, String> _stringMap(dynamic value) {
    if (value is! Map) return {};
    return value.map((key, val) => MapEntry(key.toString(), val.toString()));
  }
}

// States
abstract class InspectionState {}

class InspectionInitial extends InspectionState {}

class InspectionLoading extends InspectionState {}

class InspectionSuccess extends InspectionState {
  final bool isOffline;
  InspectionSuccess(this.isOffline);
}

class InspectionError extends InspectionState {
  final String message;
  InspectionError(this.message);
}

// Cubit
class InspectionCubit extends Cubit<InspectionState> {
  final DioClient _client;
  final OfflineQueueService _offlineQueue;
  static const _draftBoxName = 'inspection_draft_box';

  // Valid directions accepted by the backend
  static const _validDirections = {
    'front',
    'back',
    'left',
    'right',
    'dashboard',
    'tank',
    'tire',
    'light',
    'brake',
    'mirror',
    'fluid',
    'seat',
    'horn',
    'wiper',
    'extra',
  };

  InspectionCubit(this._client, this._offlineQueue)
      : super(InspectionInitial());

  Box<String> get _draftBox => Hive.box<String>(_draftBoxName);

  static Future<void> initDraftStorage() async {
    if (!Hive.isBoxOpen(_draftBoxName)) {
      await Hive.openBox<String>(_draftBoxName);
    }
  }

  Future<InspectionDraft?> loadDraft(String shiftId) async {
    final raw = _draftBox.get(shiftId);
    if (raw == null) return null;

    try {
      final draft =
          InspectionDraft.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      final directionalPhotoPaths = <String, String>{};
      for (final entry in draft.directionalPhotoPaths.entries) {
        if (File(entry.value).existsSync()) {
          directionalPhotoPaths[entry.key] = entry.value;
        }
      }
      final issuePhotoPaths = <String, String>{};
      for (final entry in draft.issuePhotoPaths.entries) {
        if (File(entry.value).existsSync()) {
          issuePhotoPaths[entry.key] = entry.value;
        }
      }
      return InspectionDraft(
        shiftId: draft.shiftId,
        currentStep: draft.currentStep,
        checks: draft.checks,
        directionalPhotoPaths: directionalPhotoPaths,
        issuePhotoPaths: issuePhotoPaths,
        notes: draft.notes,
      );
    } catch (_) {
      await _draftBox.delete(shiftId);
      return null;
    }
  }

  Future<void> saveDraft(InspectionDraft draft) async {
    await _draftBox.put(draft.shiftId, jsonEncode(draft.toJson()));
  }

  Future<void> clearDraft(String shiftId) async {
    await _draftBox.delete(shiftId);
  }

  Future<void> submitInspection({
    required String shiftId,
    required String vehicleId,
    required String type,
    required String notes,
    required Map<String, String> checks,
    required Map<String, File> directionalPhotos,
    required Map<String, File> issuePhotos,
    required List<File> optionalPhotos,
    required bool isOnline,
  }) async {
    emit(InspectionLoading());
    try {
      if (!isOnline) {
        final directionalPhotosPaths = <String, String>{};
        for (var entry in directionalPhotos.entries) {
          directionalPhotosPaths[entry.key] = entry.value.path;
        }
        final issuePhotosPaths = <String, String>{};
        for (var entry in issuePhotos.entries) {
          issuePhotosPaths[entry.key] = entry.value.path;
        }
        final optionalPhotosPaths = optionalPhotos.map((e) => e.path).toList();

        await _offlineQueue.enqueue(
          endpoint: '/inspections',
          method: 'POST',
          body: {
            '__offlineType': 'inspection_bundle',
            'shiftId': shiftId,
            'vehicleId': vehicleId,
            'type': type,
            'notes': notes,
            'checks': checks,
            'directionalPhotos': directionalPhotosPaths,
            'issuePhotos': issuePhotosPaths,
            'optionalPhotos': optionalPhotosPaths,
          },
        );
        await clearDraft(shiftId);
        emit(InspectionSuccess(true));
        return;
      }

      // Step 1: Create the inspection record
      final createResponse = await _client.dio.post('/inspections', data: {
        'shiftId': shiftId,
        'vehicleId': vehicleId,
        'type': type,
        'notes': notes,
      });

      final dataMap = parseResponseMap(createResponse.data);
      final inspectionId = (dataMap['id'] ?? '').toString();

      // Step 2: Upload directional photos as multipart/form-data
      for (var entry in directionalPhotos.entries) {
        final direction = _normalizeDirection(entry.key);
        await _uploadInspectionPhoto(inspectionId, entry.value, direction);
      }

      // Step 3: Upload issue photos
      final badItemPhotos = <String, String>{};
      for (var entry in issuePhotos.entries) {
        final direction = _normalizeDirection(entry.key);
        await _uploadInspectionPhoto(inspectionId, entry.value, direction);
        badItemPhotos[entry.key] = entry.value.path;
      }

      // Step 4: Upload optional extra photos
      for (var file in optionalPhotos) {
        await _uploadInspectionPhoto(inspectionId, file, 'extra');
      }

      // Step 5: Complete the inspection with checklist data
      await _client.dio.put('/inspections/$inspectionId/complete', data: {
        'checklistData': {
          'checks': checks,
          'notes': notes,
          'badItemPhotos': badItemPhotos,
        }
      });

      await clearDraft(shiftId);
      emit(InspectionSuccess(false));
    } catch (e) {
      emit(InspectionError(apiError(e)));
    }
  }

  Future<void> _uploadInspectionPhoto(
      String inspectionId, File photo, String direction) async {
    final bytes = await photo.readAsBytes();
    final formData = buildMultipartForm(
      fields: {'direction': direction},
      files: {
        'photo': jpegMultipartFromBytes(
          bytes,
          filename: '${direction}_${DateTime.now().millisecondsSinceEpoch}.jpg',
        ),
      },
    );
    await _client.dio.post('/inspections/$inspectionId/photos', data: formData);
  }

  String _normalizeDirection(String key) {
    final lower = key.toLowerCase();
    if (_validDirections.contains(lower)) return lower;
    const aliases = {
      'tires': 'tire',
      'brakes': 'brake',
      'lights': 'light',
      'mirrors': 'mirror',
      'wipers': 'wiper',
      'fluids': 'fluid',
      'seats': 'seat',
      'horns': 'horn',
    };
    return aliases[lower] ?? 'extra';
  }
}
