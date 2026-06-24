import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/services/offline_sync_service.dart';

// States
abstract class OfflineQueueState {}

class OfflineQueueInitial extends OfflineQueueState {}
class OfflineQueueLoading extends OfflineQueueState {}
class OfflineQueueLoaded extends OfflineQueueState {
  final List<Map<String, dynamic>> items;
  OfflineQueueLoaded(this.items);
}
class OfflineQueueSyncSuccess extends OfflineQueueState {
  final int synced;
  final int failed;
  OfflineQueueSyncSuccess({required this.synced, required this.failed});
}
class OfflineQueueError extends OfflineQueueState {
  final String message;
  OfflineQueueError(this.message);
}

// Cubit
class OfflineQueueCubit extends Cubit<OfflineQueueState> {
  final OfflineQueueService _queueService;

  OfflineQueueCubit(this._queueService) : super(OfflineQueueInitial());

  void fetchQueue() {
    emit(OfflineQueueLoading());
    try {
      final entries = _queueService.getAllEntries();
      emit(OfflineQueueLoaded(entries));
    } catch (e) {
      emit(OfflineQueueError(e.toString()));
    }
  }

  Future<void> removeQueueItem(String id) async {
    try {
      await _queueService.removeEntry(id);
      fetchQueue();
    } catch (e) {
      emit(OfflineQueueError('Failed to remove item.'));
    }
  }

  Future<void> clearAllQueue() async {
    try {
      await _queueService.clearQueue();
      fetchQueue();
    } catch (e) {
      emit(OfflineQueueError('Failed to clear queue.'));
    }
  }

  Future<void> syncNow() async {
    final entries = _queueService.getAllEntries();
    if (entries.isEmpty) return;

    emit(OfflineQueueLoading());
    try {
      final result = await _queueService.syncAll();
      emit(OfflineQueueSyncSuccess(synced: result.synced, failed: result.failed));
      fetchQueue();
    } catch (e) {
      emit(OfflineQueueError(e.toString()));
    }
  }
}
