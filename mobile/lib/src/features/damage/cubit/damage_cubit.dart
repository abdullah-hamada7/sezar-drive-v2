import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'dart:io';
import '../../../core/network/dio_client.dart';
import '../../../core/services/offline_sync_service.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

abstract class DamageState {}

class DamageInitial extends DamageState {}
class DamageLoading extends DamageState {}
class DamageReported extends DamageState {
  final bool isOffline;
  DamageReported({this.isOffline = false});
}
class DamageError extends DamageState {
  final String message;
  DamageError(this.message);
}

class DamageCubit extends Cubit<DamageState> {
  final DioClient _client;
  final OfflineQueueService _offlineQueue;

  DamageCubit(this._client, this._offlineQueue) : super(DamageInitial());

  Future<void> submitDamageReport({
    required String shiftId,
    required String vehicleId,
    required String description,
    required List<File> photos,
    required bool isOnline,
    String? tripId,
  }) async {
    emit(DamageLoading());
    try {
      if (!isOnline) {
        await _offlineQueue.enqueue(
          endpoint: '/damage-reports',
          method: 'POST',
          body: {
            '__offlineType': 'damage_bundle',
            'shiftId': shiftId,
            'vehicleId': vehicleId,
            'description': description,
            'tripId': tripId,
            'photos': photos.map((f) => f.path).toList(),
          },
        );
        emit(DamageReported(isOffline: true));
        return;
      }

      final createResponse = await _client.dio.post('/damage-reports', data: {
        'shiftId': shiftId,
        'vehicleId': vehicleId,
        'description': description,
        if (tripId != null) 'tripId': tripId,
      });
      final dataMap = parseResponseMap(createResponse.data);
      final reportId = (dataMap['id'] ?? '').toString();

      for (final photo in photos) {
        final formData = FormData.fromMap({
          'photo': await MultipartFile.fromFile(
            photo.path,
            filename: 'damage_${DateTime.now().millisecondsSinceEpoch}.jpg',
          ),
        });
        await _client.dio.post('/damage-reports/$reportId/photos', data: formData);
      }

      emit(DamageReported());
    } catch (e) {
      emit(DamageError(apiError(e, fallback: 'Failed to submit damage report.')));
    }
  }
}
