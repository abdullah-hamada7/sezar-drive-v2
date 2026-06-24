import 'package:dio/dio.dart';
import '../services/read_cache_service.dart';

/// Caches successful GET responses and serves cache on network failure.
class CacheInterceptor extends Interceptor {
  final ReadCacheService _cache = ReadCacheService();

  String _cacheKey(RequestOptions options) {
    final path = options.uri.path.replaceFirst(RegExp(r'^/api/v1'), '');
    final query = options.uri.query.isEmpty ? '' : '?${options.uri.query}';
    return '$path$query';
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) async {
    final options = response.requestOptions;
    if (options.method.toUpperCase() == 'GET') {
      final key = _cacheKey(options);
      if (ReadCacheService.isCacheable('GET', key.split('?').first)) {
        await _cache.set(key, response.data);
      }
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    if (options.method.toUpperCase() == 'GET') {
      final key = _cacheKey(options);
      final cached = await _cache.get(key);
      if (cached != null) {
        handler.resolve(Response(
          requestOptions: options,
          data: cached,
          statusCode: 200,
        ));
        return;
      }
    }
    handler.next(err);
  }
}
