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
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? '') ??
          DateTime.now(),
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
      uncollectedCashTotal:
          parseDoubleWithDefault(json['uncollectedCashTotal'], 0.0),
      uncollectedCashTripsCount:
          parseIntWithDefault(json['uncollectedCashTripsCount'], 0),
      cashCollectedTotal:
          parseDoubleWithDefault(json['cashCollectedTotal'], 0.0),
      cashCollectedTripsCount:
          parseIntWithDefault(json['cashCollectedTripsCount'], 0),
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

  HomeCubit(this._client)
      : _cache = ReadCacheService(),
        super(HomeInitial());

  Future<void> fetchHomeData() async {
    final previousHome = state is HomeLoaded ? state as HomeLoaded : null;
    if (previousHome == null) emit(HomeLoading());

    try {
      final user = await _readUser();
      final activeShift = await _readActiveShift(previousHome?.activeShift);
      final dailyReport = await _readDailyReport(previousHome?.dailyReport);
      final recentActivity =
          await _readRecentActivity(previousHome?.recentActivity ?? const []);
      final earningsHistory =
          await _readEarningsHistory(previousHome?.earningsHistory ?? const []);

      emit(HomeLoaded(
        user: user,
        activeShift: activeShift.value,
        dailyReport: dailyReport.value,
        recentActivity: recentActivity.value,
        earningsHistory: earningsHistory.value,
        isStale: activeShift.stale ||
            dailyReport.stale ||
            recentActivity.stale ||
            earningsHistory.stale,
      ));
    } catch (e) {
      if (previousHome != null) {
        emit(HomeLoaded(
          user: previousHome.user,
          activeShift: previousHome.activeShift,
          dailyReport: previousHome.dailyReport,
          recentActivity: previousHome.recentActivity,
          earningsHistory: previousHome.earningsHistory,
          isStale: true,
        ));
      } else {
        emit(HomeError(apiError(e)));
      }
    }
  }

  Future<User> _readUser() async {
    final response = await _client.dio.get('/auth/me');
    final userMap = _asMap(parseResponseMap(response.data)['user']);
    if (userMap == null) throw StateError('Missing user profile');
    return User.fromJson(userMap);
  }

  Future<({Shift? value, bool stale})> _readActiveShift(Shift? fallback) async {
    try {
      final response = await _client.dio.get('/shifts/active');
      final shiftMap = _asMap(parseResponseMap(response.data)['shift']);
      return (
        value: shiftMap == null ? null : Shift.fromJson(shiftMap),
        stale: false
      );
    } catch (_) {
      return (value: fallback, stale: true);
    }
  }

  Future<({DailyReport value, bool stale})> _readDailyReport(
    DailyReport? fallback,
  ) async {
    try {
      final response = await _client.dio.get('/stats/my-daily-report');
      await _cache.set('/stats/my-daily-report', response.data);
      return (
        value: DailyReport.fromJson(parseResponseMap(response.data)),
        stale: false
      );
    } catch (_) {
      final cached = await _cache.get('/stats/my-daily-report');
      final report = cached == null
          ? fallback ?? const DailyReport()
          : DailyReport.fromJson(parseResponseMap(cached));
      return (value: report, stale: true);
    }
  }

  Future<({List<RecentActivity> value, bool stale})> _readRecentActivity(
    List<RecentActivity> fallback,
  ) async {
    try {
      final response = await _client.dio.get(
        '/stats/my-activity',
        queryParameters: {'limit': 5},
      );
      await _cache.set('/stats/my-activity', response.data);
      return (value: _parseRecentActivity(response.data), stale: false);
    } catch (_) {
      final cached = await _cache.get('/stats/my-activity');
      return (
        value: cached == null ? fallback : _parseRecentActivity(cached),
        stale: true,
      );
    }
  }

  Future<({List<EarningsPoint> value, bool stale})> _readEarningsHistory(
    List<EarningsPoint> fallback,
  ) async {
    try {
      final response = await _client.dio.get('/stats/my-daily-revenue');
      await _cache.set('/stats/my-daily-revenue', response.data);
      return (value: _parseEarningsHistory(response.data), stale: false);
    } catch (_) {
      final cached = await _cache.get('/stats/my-daily-revenue');
      return (
        value: cached == null ? fallback : _parseEarningsHistory(cached),
        stale: true,
      );
    }
  }

  List<RecentActivity> _parseRecentActivity(dynamic raw) {
    final payload = raw is List ? raw : _asList(parseResponseMap(raw)['data']);
    return payload
        .whereType<Map>()
        .map((e) => RecentActivity.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  List<EarningsPoint> _parseEarningsHistory(dynamic raw) {
    final payload = raw is List ? raw : _asList(parseResponseMap(raw)['data']);
    return payload
        .whereType<Map>()
        .map((e) => EarningsPoint.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  List<dynamic> _asList(dynamic value) {
    if (value is List) return value;
    return const [];
  }
}
