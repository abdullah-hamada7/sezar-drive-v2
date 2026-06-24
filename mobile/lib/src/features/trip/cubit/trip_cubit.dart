import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/services/read_cache_service.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

abstract class TripState {}

class TripInitial extends TripState {}
class TripLoading extends TripState {}
class TripLoaded extends TripState {
  final List<Trip> trips;
  TripLoaded(this.trips);
}
class TripError extends TripState {
  final String message;
  TripError(this.message);
}

class TripCubit extends Cubit<TripState> {
  final DioClient _client;
  final ReadCacheService _cache;

  TripCubit(this._client) : _cache = ReadCacheService(), super(TripInitial());

  Options _idempotentOptions() => Options(
    headers: {'Idempotency-Key': const Uuid().v4()},
  );

  Future<void> fetchMyTrips() async {
    emit(TripLoading());
    try {
      final response = await _client.dio.get('/trips?limit=20');
      final dataMap = parseResponseMap(response.data);
      final List<dynamic> items =
          dataMap['data'] as List? ?? dataMap['trips'] as List? ?? [];
      final list = items
          .map((e) => Trip.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      await _cache.set('/trips?limit=20', response.data);
      emit(TripLoaded(list));
    } catch (e) {
      final cached = await _cache.get('/trips?limit=20');
      if (cached != null) {
        final cachedMap = parseResponseMap(cached);
        final List<dynamic> items = cachedMap['data'] as List? ?? cachedMap['trips'] as List? ?? [];
        final list = items.map((e) => Trip.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        emit(TripLoaded(list));
      } else {
        emit(TripError(apiError(e)));
      }
    }
  }

  bool canStartScheduledTrip(Trip trip) {
    if (trip.scheduledTime == null) return true;
    final now = DateTime.now();
    final diff = trip.scheduledTime!.difference(now);
    return diff.inHours <= 1 || diff.isNegative;
  }

  String? getScheduledStartGateError(Trip trip) {
    if (trip.scheduledTime == null) return null;
    final now = DateTime.now();
    final diff = trip.scheduledTime!.difference(now);
    if (diff.inHours > 1) {
      final hours = diff.inHours;
      final minutes = diff.inMinutes % 60;
      return 'Trip cannot start yet. Scheduled in $hours h $minutes min.';
    }
    return null;
  }

  Future<void> acceptTrip(String id) async {
    try {
      await _client.dio.patch('/trips/$id/accept', options: _idempotentOptions());
      await fetchMyTrips();
    } catch (e) {
      emit(TripError(apiError(e, fallback: 'Failed to accept trip.')));
    }
  }

  Future<void> rejectTrip(String id, String reason) async {
    try {
      await _client.dio.patch(
        '/trips/$id/reject',
        data: {'reason': reason},
        options: _idempotentOptions(),
      );
      await fetchMyTrips();
    } catch (e) {
      emit(TripError(apiError(e, fallback: 'Failed to reject trip.')));
    }
  }

  Future<void> startTrip(String id) async {
    try {
      await _client.dio.put('/trips/$id/start', options: _idempotentOptions());
      await fetchMyTrips();
    } catch (e) {
      emit(TripError(apiError(e, fallback: 'Failed to start trip. Make sure shift is active.')));
    }
  }

  Future<void> completeTrip(String id) async {
    try {
      await _client.dio.put('/trips/$id/complete', options: _idempotentOptions());
      await fetchMyTrips();
    } catch (e) {
      emit(TripError(apiError(e, fallback: 'Failed to complete trip.')));
    }
  }

  Future<void> cancelTrip(String id, String reason) async {
    try {
      await _client.dio.put(
        '/trips/$id/cancel',
        data: {'reason': reason},
        options: _idempotentOptions(),
      );
      await fetchMyTrips();
    } catch (e) {
      emit(TripError(apiError(e, fallback: 'Failed to cancel trip.')));
    }
  }

  Future<void> collectCashPayment(String id, String note) async {
    try {
      await _client.dio.put(
        '/trips/$id/cash-collected',
        data: {'note': note.trim().isNotEmpty ? note.trim() : null},
        options: _idempotentOptions(),
      );
      await fetchMyTrips();
    } catch (e) {
      emit(TripError(apiError(e, fallback: 'Failed to mark payment as cash collected.')));
    }
  }
}
