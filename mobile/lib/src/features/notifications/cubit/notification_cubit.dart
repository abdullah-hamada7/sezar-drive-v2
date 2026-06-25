import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/services/read_cache_service.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

// States
abstract class NotificationState {}

class NotificationInitial extends NotificationState {}

class NotificationLoading extends NotificationState {}

class NotificationLoaded extends NotificationState {
  final List<NotificationModel> notifications;
  final int unseenCount;
  final bool isStale;
  NotificationLoaded(
    this.notifications, {
    this.unseenCount = 0,
    this.isStale = false,
  });
}

class NotificationError extends NotificationState {
  final String message;
  NotificationError(this.message);
}

// Cubit
class NotificationCubit extends Cubit<NotificationState> {
  final DioClient _client;
  final ReadCacheService _cache;

  static const _cacheKey = '${ApiEndpoints.notifications}?limit=30';

  NotificationCubit(this._client)
      : _cache = ReadCacheService(),
        super(NotificationInitial());

  Future<void> fetchNotifications() async {
    final previous =
        state is NotificationLoaded ? state as NotificationLoaded : null;
    if (previous == null) emit(NotificationLoading());
    try {
      final response = await _client.dio.get(
        ApiEndpoints.notifications,
        queryParameters: {'limit': 30},
      );
      await _cache.set(_cacheKey, response.data);
      _emitFromPayload(parseResponseMap(response.data));
    } catch (e) {
      final cached = await _cache.get(_cacheKey);
      if (cached != null) {
        _emitFromPayload(parseResponseMap(cached), isStale: true);
        return;
      }
      if (previous != null) {
        emit(NotificationLoaded(
          previous.notifications,
          unseenCount: previous.unseenCount,
          isStale: true,
        ));
      } else {
        emit(NotificationError(apiError(e)));
      }
    }
  }

  Future<void> markAllAsRead() async {
    final previous =
        state is NotificationLoaded ? state as NotificationLoaded : null;
    try {
      await _client.dio.patch(ApiEndpoints.markAllNotificationsRead);
      if (previous != null) {
        emit(NotificationLoaded(
          previous.notifications.map(_asRead).toList(),
          unseenCount: 0,
          isStale: previous.isStale,
        ));
      } else if (state is! NotificationLoading) {
        await fetchNotifications();
      }
    } catch (_) {}
  }

  Future<void> markAsRead(List<String> ids) async {
    final previous =
        state is NotificationLoaded ? state as NotificationLoaded : null;
    try {
      await _client.dio.patch('/notifications/mark-read', data: {'ids': ids});
      if (previous != null) {
        final idSet = ids.toSet();
        final updated = previous.notifications
            .map((notification) => idSet.contains(notification.id)
                ? _asRead(notification)
                : notification)
            .toList();
        final unseenCount =
            updated.where((notification) => !notification.isRead).length;
        emit(NotificationLoaded(
          updated,
          unseenCount: unseenCount,
          isStale: previous.isStale,
        ));
      } else if (state is! NotificationLoading) {
        await fetchNotifications();
      }
    } catch (_) {}
  }

  void _emitFromPayload(
    Map<String, dynamic> notificationPayload, {
    bool isStale = false,
  }) {
    final items = _extractNotifications(notificationPayload);
    final list = <NotificationModel>[];
    for (final item in items) {
      if (item is! Map) continue;
      try {
        list.add(
          NotificationModel.fromJson(Map<String, dynamic>.from(item)),
        );
      } catch (_) {}
    }
    final unseenCount = parseIntWithDefault(
      notificationPayload['unseenCount'] ?? notificationPayload['unseen_count'],
      list.where((notification) => !notification.isRead).length,
    );
    emit(NotificationLoaded(list, unseenCount: unseenCount, isStale: isStale));
  }

  List<dynamic> _extractNotifications(
      Map<String, dynamic> notificationPayload) {
    final nested = notificationPayload['data'];
    if (nested is Map) {
      final nestedMap = Map<String, dynamic>.from(nested);
      if (nestedMap['notifications'] is List) {
        return nestedMap['notifications'] as List;
      }
      if (nestedMap['items'] is List) {
        return nestedMap['items'] as List;
      }
    }
    if (notificationPayload['notifications'] is List) {
      return notificationPayload['notifications'] as List;
    }
    if (notificationPayload['items'] is List) {
      return notificationPayload['items'] as List;
    }
    if (notificationPayload['data'] is List) {
      return notificationPayload['data'] as List;
    }
    return const [];
  }

  NotificationModel _asRead(NotificationModel notification) {
    return NotificationModel(
      id: notification.id,
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      entityId: notification.entityId,
      isRead: true,
      createdAt: notification.createdAt,
    );
  }
}
