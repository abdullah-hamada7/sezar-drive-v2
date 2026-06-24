import 'dart:io';
import 'dart:async';
import 'dart:convert';
import 'package:hive/hive.dart';
import 'package:uuid/uuid.dart';
import 'package:dio/dio.dart';
import '../network/dio_client.dart';
import '../utils/parsers.dart';

class SyncResult {
  final int synced;
  final int failed;
  final int pending;
  const SyncResult({required this.synced, required this.failed, required this.pending});
}

class OfflineQueueService {
  static const String _boxName = 'offline_queue';
  static const int maxRetries = 3;
  final DioClient _client;
  final StreamController<int> _pendingController = StreamController<int>.broadcast();

  OfflineQueueService(this._client);

  Stream<int> get onPendingCountChanged => _pendingController.stream;

  static Future<void> init() async {
    await Hive.openBox<String>(_boxName);
  }

  Future<Box<String>> get _box async => Hive.openBox<String>(_boxName);

  Future<void> enqueue({
    required String endpoint,
    required String method,
    required Map<String, dynamic> body,
    String? idempotencyKey,
  }) async {
    final entry = {
      'id': const Uuid().v4(),
      'endpoint': endpoint,
      'method': method,
      'body': body,
      'idempotencyKey': idempotencyKey ?? const Uuid().v4(),
      'retryCount': 0,
      'createdAt': DateTime.now().toIso8601String(),
    };
    final box = await _box;
    final raw = _decodeQueue(box.get('queue', defaultValue: '[]')!);
    raw.add(entry);
    await box.put('queue', jsonEncode(raw));
    _emitPendingCount(raw.length);
  }

  List<Map<String, dynamic>> getAllEntries() {
    final box = Hive.box<String>(_boxName);
    final raw = box.get('queue', defaultValue: '[]');
    if (raw == null) return [];
    return _decodeQueue(raw).cast<Map<String, dynamic>>();
  }

  int get pendingCount => getAllEntries().length;

  Future<void> removeEntry(String id) async {
    final box = await _box;
    final raw = _decodeQueue(box.get('queue', defaultValue: '[]')!);
    raw.removeWhere((e) => e['id'] == id);
    await box.put('queue', jsonEncode(raw));
    _emitPendingCount(raw.length);
  }

  Future<void> clearQueue() async {
    final box = await _box;
    await box.put('queue', '[]');
    _emitPendingCount(0);
  }

  bool _isTransientError(dynamic e) {
    if (e is DioException) {
      return e.type == DioExceptionType.connectionTimeout ||
             e.type == DioExceptionType.sendTimeout ||
             e.type == DioExceptionType.receiveTimeout ||
             e.type == DioExceptionType.connectionError;
    }
    return false;
  }

  Future<SyncResult> syncAll() async {
    final entries = getAllEntries();
    if (entries.isEmpty) {
      return const SyncResult(synced: 0, failed: 0, pending: 0);
    }

    int synced = 0;
    int failed = 0;
    final remaining = <Map<String, dynamic>>[];

    for (final entry in entries) {
      final retryCount = entry['retryCount'] as int? ?? 0;
      if (retryCount >= maxRetries) {
        failed++;
        continue;
      }

      try {
        await _replayEntry(entry);
        synced++;
      } catch (e) {
        if (!_isTransientError(e)) {
          entry['retryCount'] = retryCount + 1;
        }
        remaining.add(entry);
        failed++;
      }
    }

    // Keep only failed entries that haven't exceeded max retries
    final box = await _box;
    final stillPending = remaining.where((e) => (e['retryCount'] as int? ?? 0) < maxRetries).toList();
    await box.put('queue', jsonEncode(stillPending));
    _emitPendingCount(stillPending.length);

    return SyncResult(synced: synced, failed: failed, pending: stillPending.length);
  }

  Future<void> _replayEntry(Map<String, dynamic> entry) async {
    final endpoint = entry['endpoint'] as String;
    final method = (entry['method'] as String).toUpperCase();
    final body = Map<String, dynamic>.from(entry['body'] as Map);
    final idempotencyKey = entry['idempotencyKey'] as String?;
    final offlineType = body['__offlineType'] as String?;

    if (offlineType == 'expense_bundle') {
      await _syncExpenseBundle(body);
    } else if (offlineType == 'damage_bundle') {
      await _syncDamageBundle(body);
    } else if (offlineType == 'inspection_bundle') {
      await _syncInspectionBundle(body);
    } else {
      final options = idempotencyKey != null
          ? Options(headers: {'Idempotency-Key': idempotencyKey})
          : null;
      switch (method) {
        case 'POST':
          await _client.dio.post(endpoint, data: body, options: options);
          break;
        case 'PUT':
          await _client.dio.put(endpoint, data: body, options: options);
          break;
        case 'PATCH':
          await _client.dio.patch(endpoint, data: body, options: options);
          break;
        case 'DELETE':
          await _client.dio.delete(endpoint, data: body, options: options);
          break;
      }
    }
  }

  Future<void> _syncExpenseBundle(Map<String, dynamic> body) async {
    final receiptPath = body['receiptPath'] as String?;
    final formMap = <String, dynamic>{
      'shiftId': body['shiftId']?.toString() ?? '',
      'categoryId': body['categoryId']?.toString() ?? '',
      'amount': body['amount']?.toString() ?? '0',
      'description': body['description']?.toString() ?? '',
      if (body['tripId'] != null) 'tripId': body['tripId'].toString(),
    };
    if (receiptPath != null) {
      final receiptFile = File(receiptPath);
      if (await receiptFile.exists()) {
        formMap['receipt'] = await MultipartFile.fromFile(
          receiptPath,
          filename: 'receipt_sync.jpg',
        );
      }
    }
    await _client.dio.post('/expenses', data: FormData.fromMap(formMap));
  }

  Future<void> _syncDamageBundle(Map<String, dynamic> body) async {
    final response = await _client.dio.post('/damage-reports', data: {
      'shiftId': body['shiftId'],
      'vehicleId': body['vehicleId'],
      'description': body['description'],
      if (body['tripId'] != null) 'tripId': body['tripId'],
    });
    final dataMap = parseResponseMap(response.data);
    final reportId = (dataMap['id'] ?? '').toString();
    final photoPaths = body['photos'] as List? ?? [];
    for (final path in photoPaths) {
      final file = File(path.toString());
      if (!await file.exists()) continue;
      final multipart = await MultipartFile.fromFile(file.path, filename: 'damage_sync.jpg');
      await _client.dio.post(
        '/damage-reports/$reportId/photos',
        data: FormData.fromMap({'photo': multipart}),
      );
    }
  }

  Future<void> _syncInspectionBundle(Map<String, dynamic> body) async {
    final response = await _client.dio.post('/inspections', data: {
      'shiftId': body['shiftId'],
      'vehicleId': body['vehicleId'],
      'type': body['type'] ?? 'checklist',
      'notes': body['notes'] ?? '',
    });
    final dataMap = parseResponseMap(response.data);
    final inspectionId = (dataMap['id'] ?? '').toString();
    final directionalPhotos = body['directionalPhotos'] as Map? ?? {};
    for (final entry in directionalPhotos.entries) {
      final file = File(entry.value.toString());
      if (!await file.exists()) continue;
      final multipart = await MultipartFile.fromFile(file.path, filename: 'dir_sync.jpg');
      await _client.dio.post(
        '/inspections/$inspectionId/photos',
        data: FormData.fromMap({'photo': multipart, 'direction': entry.key.toString()}),
      );
    }
    await _client.dio.put('/inspections/$inspectionId/complete', data: {
      'checklistData': {
        'checks': body['checks'] ?? {},
        'notes': body['notes'] ?? '',
      },
    });
  }

  List<dynamic> _decodeQueue(String raw) {
    try {
      return jsonDecode(raw) as List<dynamic>;
    } catch (_) {
      return [];
    }
  }

  void _emitPendingCount(int count) {
    if (!_pendingController.isClosed) {
      _pendingController.add(count);
    }
  }

  void dispose() {
    _pendingController.close();
  }
}
