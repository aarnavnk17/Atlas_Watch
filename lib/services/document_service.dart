import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'backend_service.dart';

class DocumentService {
  Future<List<dynamic>> getDocuments() async {
    try {
      final response = await BackendService.get('/documents');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['documents'] ?? [];
      }
    } catch (e) {
      debugPrint('Error fetching documents: $e');
    }
    return [];
  }

  Future<bool> uploadDocument(File file, String category) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${BackendService.baseUrl}/documents/upload'),
      )
        ..headers.addAll(await BackendService.authHeaders(json: false))
        ..fields['category'] = category
        // The server validates the real type and picks the stored filename; it
        // rejects anything outside the allowed document types.
        ..files.add(await http.MultipartFile.fromPath('file', file.path));

      final response = await http.Response.fromStream(await request.send());
      if (response.statusCode != 200) {
        debugPrint('Upload rejected (${response.statusCode}): ${response.body}');
      }
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error uploading document: $e');
      return false;
    }
  }

  Future<bool> deleteDocument(String id) async {
    try {
      final response = await BackendService.delete('/documents/$id');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error deleting document: $e');
      return false;
    }
  }

  /// Documents are served through an authenticated endpoint, so viewing one
  /// means downloading it with the session token rather than opening a URL.
  Future<File?> downloadDocument(String id, String fileName, Directory directory) async {
    try {
      final response = await BackendService.get('/documents/$id/file');
      if (response.statusCode != 200) return null;

      final file = File('${directory.path}/$fileName');
      await file.writeAsBytes(response.bodyBytes);
      return file;
    } catch (e) {
      debugPrint('Error downloading document: $e');
      return null;
    }
  }
}
