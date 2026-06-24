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
    emit(NotificationLoading());
    try {
      final response = await _client.dio.get('/notifications');
      // Backend returns { notifications: [...], total, unseenCount }
      final raw = response.data;
      final List<dynamic> items =
          raw['notifications'] as List? ??
          raw['items'] as List? ?? [];
      final list = items
          .map((e) => NotificationModel.fromJson(e as Map<String, dynamic>))
          .toList();
      final unseenCount = parseIntWithDefault(raw['unseenCount'], 0);
      emit(NotificationLoaded(list, unseenCount: unseenCount));
    } catch (e) {
      emit(NotificationError(apiError(e)));
    }
  }

  Future<void> markAllAsRead() async {
    try {
      // ✅ Backend: PATCH /notifications/mark-all-read
      await _client.dio.patch('/notifications/mark-all-read');
      await fetchNotifications();
    } catch (_) {}
  }

  Future<void> markAsRead(List<String> ids) async {
    try {
      // ✅ Backend: PATCH /notifications/mark-read with body { ids: [...] }
      await _client.dio.patch('/notifications/mark-read', data: {'ids': ids});
      await fetchNotifications();
    } catch (_) {}
  }
}
