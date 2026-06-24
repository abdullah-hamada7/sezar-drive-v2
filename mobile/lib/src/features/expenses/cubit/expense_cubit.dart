import 'package:flutter_bloc/flutter_bloc.dart';
import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/services/offline_sync_service.dart';
import '../../../core/domain/driver_models.dart';
import '../../../core/utils/api_error.dart';
import '../../../core/utils/parsers.dart';

abstract class ExpenseState {}

class ExpenseInitial extends ExpenseState {}
class ExpenseLoading extends ExpenseState {}
class ExpenseLoaded extends ExpenseState {
  final List<Expense> expenses;
  final List<ExpenseCategory> categories;
  final List<Trip> acceptedTrips;
  ExpenseLoaded({
    required this.expenses,
    required this.categories,
    required this.acceptedTrips,
  });
}
class ExpenseSuccess extends ExpenseState {
  final bool isOffline;
  ExpenseSuccess(this.isOffline);
}
class ExpenseError extends ExpenseState {
  final String message;
  ExpenseError(this.message);
}

class ExpenseCubit extends Cubit<ExpenseState> {
  final DioClient _client;
  final OfflineQueueService _offlineQueue;

  ExpenseCubit(this._client, this._offlineQueue) : super(ExpenseInitial());

  Future<List<Trip>> _fetchAcceptedTrips() async {
    try {
      final response = await _client.dio.get(
        '/trips',
        queryParameters: {'status': 'ACCEPTED', 'limit': 100},
      );
      final dataMap = parseResponseMap(response.data);
      final List<dynamic> items =
          dataMap['trips'] as List? ?? dataMap['data'] as List? ?? [];
      return items
          .map((e) => Trip.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> fetchExpensesAndCategories() async {
    emit(ExpenseLoading());
    try {
      final results = await Future.wait([
        _client.dio.get('/expenses'),
        _client.dio.get('/expenses/categories'),
        _fetchAcceptedTrips(),
      ]);

      final expResponse = results[0] as Response;
      final catResponse = results[1] as Response;
      final acceptedTrips = results[2] as List<Trip>;

      final expMap = parseResponseMap(expResponse.data);
      final expensesList = expMap['expenses'] as List? ?? [];
      final expenses = expensesList
          .map((e) => Expense.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();

      final catRaw = catResponse.data;
      final List<dynamic> catList;
      if (catRaw is List) {
        catList = catRaw;
      } else {
        final catMap = parseResponseMap(catRaw);
        catList = catMap['categories'] as List? ?? [];
      }
      final categories = catList
          .map((e) => ExpenseCategory.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();

      emit(ExpenseLoaded(
        expenses: expenses,
        categories: categories,
        acceptedTrips: acceptedTrips,
      ));
    } catch (e) {
      emit(ExpenseError(apiError(e)));
    }
  }

  Future<void> submitExpense({
    required String shiftId,
    required String tripId,
    required String categoryId,
    required double amount,
    required String description,
    required File? receiptFile,
    required bool isOnline,
  }) async {
    emit(ExpenseLoading());
    try {
      if (!isOnline) {
        await _offlineQueue.enqueue(
          endpoint: '/expenses',
          method: 'POST',
          body: {
            '__offlineType': 'expense_bundle',
            'shiftId': shiftId,
            'tripId': tripId,
            'categoryId': categoryId,
            'amount': amount,
            'description': description,
            'receiptPath': receiptFile?.path,
          },
        );
        emit(ExpenseSuccess(true));
        return;
      }

      final formData = FormData.fromMap({
        'shiftId': shiftId,
        'tripId': tripId,
        'categoryId': categoryId,
        'amount': amount.toString(),
        'description': description,
        if (receiptFile != null)
          'receipt': await MultipartFile.fromFile(
            receiptFile.path,
            filename: 'receipt_${DateTime.now().millisecondsSinceEpoch}.jpg',
          ),
      });

      await _client.dio.post('/expenses', data: formData);

      emit(ExpenseSuccess(false));
    } catch (e) {
      emit(ExpenseError(apiError(e)));
    }
  }
}
