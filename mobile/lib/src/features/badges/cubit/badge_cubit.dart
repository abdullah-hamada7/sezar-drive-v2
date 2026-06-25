import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/services/tab_badge_service.dart';

abstract class BadgeState {}

class BadgeInitial extends BadgeState {}

class BadgeLoaded extends BadgeState {
  final DriverBadgeCounts counts;
  BadgeLoaded(this.counts);
}

class BadgeCubit extends Cubit<BadgeState> {
  final TabBadgeService _badgeService;
  Timer? _pollTimer;

  /// WS events refresh badges immediately; this is a slow fallback only.
  static const Duration _fallbackPollInterval = Duration(seconds: 120);

  BadgeCubit(this._badgeService) : super(BadgeInitial());

  void startPolling() {
    fetchCounts();
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(_fallbackPollInterval, (_) => fetchCounts());
  }

  Future<void> fetchCounts() async {
    try {
      final counts = await _badgeService.fetchCounts();
      emit(BadgeLoaded(counts));
    } catch (_) {
      // Keep last known counts on transient failures.
    }
  }

  Future<void> markViewed(String tab) async {
    try {
      await _badgeService.markTabViewed(tab);
      await fetchCounts();
    } catch (_) {}
  }

  @override
  Future<void> close() {
    _pollTimer?.cancel();
    return super.close();
  }
}
