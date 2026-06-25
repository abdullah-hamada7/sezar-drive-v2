import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';

/// Builds multipart form data with text fields before files (multer-friendly).
FormData buildMultipartForm({
  Map<String, String>? fields,
  Map<String, MultipartFile>? files,
}) {
  final formData = FormData();
  if (fields != null) {
    for (final entry in fields.entries) {
      formData.fields.add(MapEntry(entry.key, entry.value));
    }
  }
  if (files != null) {
    for (final entry in files.entries) {
      formData.files.add(MapEntry(entry.key, entry.value));
    }
  }
  return formData;
}

MultipartFile jpegMultipartFromBytes(
  List<int> bytes, {
  required String filename,
}) {
  return MultipartFile.fromBytes(
    bytes,
    filename: filename,
    contentType: MediaType('image', 'jpeg'),
  );
}
