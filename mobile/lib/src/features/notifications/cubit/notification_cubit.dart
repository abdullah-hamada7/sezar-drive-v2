import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/dio_client.dart';
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
  NotificationLoaded(this.notifications, {this.unseenCount = 0});
}

class NotificationError extends NotificationState {
  final String message;
  NotificationError(this.message);
}

// Cubit
class NotificationCubit extends Cubit<NotificationState> {
  final DioClient _client;

  NotificationCubit(this._client) : super(NotificationInitial());

  Future<void> fetchNotifications() async {
    final previous =
        state is NotificationLoaded ? state as NotificationLoaded : null;
    if (previous == null) emit(NotificationLoading());
    try {
      final response = await _client.dio.get(
        '/notifications',
        queryParameters: {'limit': 30},
      );
      final notificationPayload = parseResponseMap(response.data);
      final items = _extractNotifications(notificationPayload);
      final list = items
          .whereType<Map>()
          .map((e) => NotificationModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      final unseenCount =
          parseIntWithDefault(notificationPayload['unseenCount'], 0);
      emit(NotificationLoaded(list, unseenCount: unseenCount));
    } catch (e) {
      if (previous != null) {
        emit(previous);
      } else {
        emit(NotificationError(apiError(e)));
      }
    }
  }

  Future<void> markAllAsRead() async {
    final previous =
        state is NotificationLoaded ? state as NotificationLoaded : null;
    try {
      await _client.dio.patch('/notifications/mark-all-read');
      if (previous != null) {
        emit(NotificationLoaded(
          previous.notifications.map(_asRead).toList(),
          unseenCount: 0,
        ));
      } else {
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
        emit(NotificationLoaded(updated, unseenCount: unseenCount));
      } else {
        await fetchNotifications();
      }
    } catch (_) {}
  }

  List<dynamic> _extractNotifications(
      Map<String, dynamic> notificationPayload) {
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
