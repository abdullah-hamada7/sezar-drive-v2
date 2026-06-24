import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/services/read_cache_service.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

abstract class ViolationState {}

class ViolationInitial extends ViolationState {}
class ViolationLoading extends ViolationState {}
class ViolationLoaded extends ViolationState {
  final List<TrafficViolation> violations;
  final List<TrafficViolation> filtered;
  ViolationLoaded({required this.violations, required this.filtered});
}
class ViolationError extends ViolationState {
  final String message;
  ViolationError(this.message);
}

class ViolationCubit extends Cubit<ViolationState> {
  final DioClient _client;
  final ReadCacheService _cache;

  DateTime? _fromDate;
  DateTime? _toDate;
  String _searchQuery = '';

  ViolationCubit(this._client) : _cache = ReadCacheService(), super(ViolationInitial());

  Future<void> fetchMyViolations() async {
    emit(ViolationLoading());
    try {
      final response = await _client.dio.get('/violations/my');
      final dataMap = parseResponseMap(response.data);
      final List<dynamic> items = dataMap['data'] as List? ?? dataMap['violations'] as List? ?? [];
      final list = items
          .map((e) => TrafficViolation.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      await _cache.set('/violations/my', response.data);
      _applyFilters(list);
    } catch (e) {
      final cached = await _cache.get('/violations/my');
      if (cached != null) {
        final cachedMap = parseResponseMap(cached);
        final List<dynamic> items = cachedMap['data'] as List? ?? cachedMap['violations'] as List? ?? [];
        final list = items.map((e) => TrafficViolation.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        _applyFilters(list);
      } else {
        emit(ViolationError(apiError(e)));
      }
    }
  }

  void setDateFilter(DateTime? from, DateTime? to) {
    _fromDate = from;
    _toDate = to;
    final prevState = state;
    if (prevState is ViolationLoaded) {
      _applyFilters(prevState.violations);
    } else {
      fetchMyViolations();
    }
  }

  void setSearchQuery(String query) {
    _searchQuery = query.trim().toLowerCase();
    final prevState = state;
    if (prevState is ViolationLoaded) {
      _applyFilters(prevState.violations);
    }
  }

  void clearFilters() {
    _fromDate = null;
    _toDate = null;
    _searchQuery = '';
    final prevState = state;
    if (prevState is ViolationLoaded) {
      _applyFilters(prevState.violations);
    }
  }

  void _applyFilters(List<TrafficViolation> all) {
    var filtered = all;

    if (_fromDate != null) {
      filtered = filtered.where((v) => !v.date.isBefore(_fromDate!)).toList();
    }
    if (_toDate != null) {
      final endOfDay = DateTime(_toDate!.year, _toDate!.month, _toDate!.day, 23, 59, 59);
      filtered = filtered.where((v) => !v.date.isAfter(endOfDay)).toList();
    }
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((v) {
        final location = v.location.toLowerCase();
        final number = v.violationNumber.toLowerCase();
        final time = v.time.toLowerCase();
        return location.contains(_searchQuery) ||
            number.contains(_searchQuery) ||
            time.contains(_searchQuery);
      }).toList();
    }

    emit(ViolationLoaded(violations: all, filtered: filtered));
  }
}
