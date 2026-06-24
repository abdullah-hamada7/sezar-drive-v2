import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/services/read_cache_service.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

class RecentActivity {
  final String id;
  final String type;
  final String title;
  final double? amount;
  final String status;
  final DateTime timestamp;

  RecentActivity({
    required this.id,
    required this.type,
    required this.title,
    this.amount,
    required this.status,
    required this.timestamp,
  });

  factory RecentActivity.fromJson(Map<String, dynamic> json) {
    return RecentActivity(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      amount: parseDouble(json['amount']),
      status: (json['status'] ?? '').toString(),
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now(),
    );
  }
}

class EarningsPoint {
  final String hour;
  final double amount;

  EarningsPoint({required this.hour, required this.amount});

  factory EarningsPoint.fromJson(Map<String, dynamic> json) {
    return EarningsPoint(
      hour: (json['hour'] ?? '0:00').toString(),
      amount: parseDoubleWithDefault(json['amount'], 0.0),
    );
  }
}

class DailyReport {
  final double uncollectedCashTotal;
  final int uncollectedCashTripsCount;
  final double cashCollectedTotal;
  final int cashCollectedTripsCount;

  const DailyReport({
    this.uncollectedCashTotal = 0,
    this.uncollectedCashTripsCount = 0,
    this.cashCollectedTotal = 0,
    this.cashCollectedTripsCount = 0,
  });

  factory DailyReport.fromJson(Map<String, dynamic> json) {
    return DailyReport(
      uncollectedCashTotal: parseDoubleWithDefault(json['uncollectedCashTotal'], 0.0),
      uncollectedCashTripsCount: parseIntWithDefault(json['uncollectedCashTripsCount'], 0),
      cashCollectedTotal: parseDoubleWithDefault(json['cashCollectedTotal'], 0.0),
      cashCollectedTripsCount: parseIntWithDefault(json['cashCollectedTripsCount'], 0),
    );
  }
}

abstract class HomeState {}

class HomeInitial extends HomeState {}
class HomeLoading extends HomeState {}
class HomeLoaded extends HomeState {
  final User user;
  final Shift? activeShift;
  final DailyReport dailyReport;
  final List<RecentActivity> recentActivity;
  final List<EarningsPoint> earningsHistory;
  final bool isStale;

  HomeLoaded({
    required this.user,
    this.activeShift,
    required this.dailyReport,
    required this.recentActivity,
    required this.earningsHistory,
    this.isStale = false,
  });
}
class HomeError extends HomeState {
  final String message;
  HomeError(this.message);
}

class HomeCubit extends Cubit<HomeState> {
  final DioClient _client;
  final ReadCacheService _cache;

  HomeCubit(this._client) : _cache = ReadCacheService(), super(HomeInitial());

  Future<void> fetchHomeData() async {
    if (state is! HomeLoaded) emit(HomeLoading());
    try {
      final results = await Future.wait([
        _client.dio.get('/auth/me'),
        _client.dio.get('/shifts/active'),
        _client.dio.get('/stats/my-daily-report'),
        _client.dio.get('/stats/my-activity', queryParameters: {'limit': 5}),
        _client.dio.get('/stats/my-daily-revenue'),
      ]);

      final user = User.fromJson(results[0].data['user'] as Map<String, dynamic>);
      final shiftData = results[1].data['shift'] as Map<String, dynamic>?;
      final shift = shiftData != null ? Shift.fromJson(shiftData) : null;
      final dailyReport = DailyReport.fromJson(results[2].data as Map<String, dynamic>);

      final activityRaw = results[3].data;
      final recentActivity = (activityRaw is List ? activityRaw : (activityRaw['data'] as List? ?? []))
          .map((e) => RecentActivity.fromJson(e as Map<String, dynamic>))
          .toList();

      final earningsRaw = results[4].data;
      final earningsHistory = (earningsRaw is List ? earningsRaw : (earningsRaw['data'] as List? ?? []))
          .map((e) => EarningsPoint.fromJson(e as Map<String, dynamic>))
          .toList();

      await _cache.set('/stats/my-activity', activityRaw);
      await _cache.set('/stats/my-daily-revenue', earningsRaw);

      emit(HomeLoaded(
        user: user,
        activeShift: shift,
        dailyReport: dailyReport,
        recentActivity: recentActivity,
        earningsHistory: earningsHistory,
      ));
    } catch (e) {
      // Fall back to cached reads when offline.
      try {
        final cachedActivity = await _cache.get('/stats/my-activity');
        final cachedEarnings = await _cache.get('/stats/my-daily-revenue');
        if (cachedActivity != null || cachedEarnings != null) {
          final activities = (cachedActivity is List ? cachedActivity : (cachedActivity?['data'] as List? ?? []))
              .map((e) => RecentActivity.fromJson(e as Map<String, dynamic>))
              .toList();
          final earnings = (cachedEarnings is List ? cachedEarnings : (cachedEarnings?['data'] as List? ?? []))
              .map((e) => EarningsPoint.fromJson(e as Map<String, dynamic>))
              .toList();

          if (state is HomeLoaded) {
            final prev = state as HomeLoaded;
            emit(HomeLoaded(
              user: prev.user,
              activeShift: prev.activeShift,
              dailyReport: prev.dailyReport,
              recentActivity: activities,
              earningsHistory: earnings,
              isStale: true,
            ));
          } else {
            emit(HomeError('Offline — cached data only.'));
          }
          return;
        }
      } catch (_) {}

      emit(HomeError(apiError(e)));
    }
  }
}
