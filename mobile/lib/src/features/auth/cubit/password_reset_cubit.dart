import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/utils/parsers.dart';

abstract class PasswordResetState {}

class PasswordResetInitial extends PasswordResetState {}
class PasswordResetLoading extends PasswordResetState {}
class PasswordResetCodeSent extends PasswordResetState {
  final String email;
  PasswordResetCodeSent(this.email);
}
class PasswordResetCodeVerified extends PasswordResetState {
  final String resetToken;
  PasswordResetCodeVerified(this.resetToken);
}
class PasswordResetSuccess extends PasswordResetState {}
class PasswordResetError extends PasswordResetState {
  final String message;
  PasswordResetError(this.message);
}

class PasswordResetCubit extends Cubit<PasswordResetState> {
  final DioClient _client;

  PasswordResetCubit(this._client) : super(PasswordResetInitial());

  Future<void> requestRescue(String email) async {
    emit(PasswordResetLoading());
    try {
      await _client.dio.post('/auth/rescue/request', data: {
        'email': email.trim(),
      });
      emit(PasswordResetCodeSent(email.trim()));
    } catch (e) {
      emit(PasswordResetError(_extractError(e)));
    }
  }

  Future<void> verifyRescueCode(String email, String code) async {
    emit(PasswordResetLoading());
    try {
      final response = await _client.dio.post('/auth/rescue/verify', data: {
        'email': email.trim(),
        'code': code.trim(),
      });
      final dataMap = parseResponseMap(response.data);
      final resetToken = dataMap['resetToken'] as String?;
      if (resetToken != null) {
        emit(PasswordResetCodeVerified(resetToken));
      } else {
        emit(PasswordResetError('Invalid verification code.'));
      }
    } catch (e) {
      emit(PasswordResetError(_extractError(e)));
    }
  }

  Future<void> resetPassword(String token, String newPassword) async {
    emit(PasswordResetLoading());
    try {
      await _client.dio.post('/auth/reset-password', data: {
        'token': token,
        'newPassword': newPassword,
      });
      emit(PasswordResetSuccess());
    } catch (e) {
      emit(PasswordResetError(_extractError(e)));
    }
  }

  String _extractError(dynamic e) {
    try {
      final response = (e as DioException).response;
      if (response?.data is Map) {
        final data = response!.data as Map;
        final error = data['error'];
        if (error is Map && error['message'] != null) return error['message'].toString();
        if (data['message'] != null) return data['message'].toString();
        if (error is String) return error;
      }
    } catch (_) {}
    return 'An error occurred. Please try again.';
  }
}
