import 'package:flutter_bloc/flutter_bloc.dart';
import 'dart:io';
import '../../../core/network/dio_client.dart';
import '../../../core/network/multipart_form.dart';
import '../../../core/services/offline_sync_service.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

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

  // Valid directions accepted by the backend
  static const _validDirections = {
    'front', 'back', 'left', 'right', 'dashboard',
    'tank', 'tire', 'light', 'brake', 'mirror',
    'fluid', 'seat', 'horn', 'wiper', 'extra',
  };

  InspectionCubit(this._client, this._offlineQueue) : super(InspectionInitial());

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
        emit(InspectionSuccess(true));
        return;
      }

      // Step 1: Create the inspection record
      final createResponse = await _client.dio.post('/inspections', data: {
        'shiftId': shiftId,
        'vehicleId': vehicleId,
        'type': type,  // must be: 'full' | 'checklist' | 'pre' | 'post'
        'notes': notes,
      });

      final dataMap = parseResponseMap(createResponse.data);
      final inspectionId = (dataMap['id'] ?? '').toString();

      // Step 2: Upload directional photos as multipart/form-data
      // Backend: POST /inspections/:id/photos with field 'photo' + body 'direction'
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

      emit(InspectionSuccess(false));
    } catch (e) {
      emit(InspectionError(apiError(e)));
    }
  }

  /// Upload a single photo file as multipart to the backend.
  /// Backend expects: POST /inspections/:id/photos
  /// with Content-Type: multipart/form-data, field: 'photo', body field: 'direction'
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

  /// Map any direction key to a backend-valid direction enum value.
  String _normalizeDirection(String key) {
    final lower = key.toLowerCase();
    if (_validDirections.contains(lower)) return lower;
    // Common aliases
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
