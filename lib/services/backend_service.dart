import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'auth_store.dart';

/// HTTP entry point for every backend call.
///
/// The base URL is configured, not discovered. An earlier version probed a list
/// of private network addresses (192.168.1.1, 10.0.0.1, …) and used whichever
/// host answered first — on an untrusted network that means posting the user's
/// credentials and live location to a stranger's server.
///
/// Override per build with:
///   flutter run --dart-define=API_BASE_URL=https://api.example.com
class BackendService {
  static const Duration _requestTimeout = Duration(seconds: 15);

  /// Compile-time override; empty when not supplied.
  static const String _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) return _configuredBaseUrl;

    // Debug-only conveniences for the standard local setups.
    if (kDebugMode) {
      if (kIsWeb) return 'http://localhost:3000';
      if (Platform.isAndroid) return 'http://10.0.2.2:3000'; // Android emulator host loopback
      return 'http://localhost:3000';
    }

    throw StateError(
      'API_BASE_URL is not set. Build with '
      '--dart-define=API_BASE_URL=https://your-backend.example.com',
    );
  }

  /// Kept for callers that need the host (multipart uploads).
  static Future<String> getBaseUrl() async => baseUrl;

  static Future<Map<String, String>> authHeaders({bool json = true}) async {
    final token = await AuthStore.token();
    return {
      if (json) 'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<http.Response> get(String path, {Map<String, String>? headers}) =>
      _send(() async => http.get(
            Uri.parse(baseUrl + path),
            headers: {...await authHeaders(json: false), ...?headers},
          ));

  static Future<http.Response> post(String path, {Map<String, String>? headers, Object? body}) =>
      _send(() async => http.post(
            Uri.parse(baseUrl + path),
            headers: {...await authHeaders(), ...?headers},
            body: body,
          ));

  static Future<http.Response> put(String path, {Map<String, String>? headers, Object? body}) =>
      _send(() async => http.put(
            Uri.parse(baseUrl + path),
            headers: {...await authHeaders(), ...?headers},
            body: body,
          ));

  static Future<http.Response> delete(String path, {Map<String, String>? headers}) =>
      _send(() async => http.delete(
            Uri.parse(baseUrl + path),
            headers: {...await authHeaders(), ...?headers},
          ));

  /// Runs a request and turns a rejected token into a clean sign-out.
  static Future<http.Response> _send(Future<http.Response> Function() request) async {
    final response = await request().timeout(_requestTimeout);
    if (response.statusCode == 401) {
      debugPrint('Backend rejected the session token — signing out.');
      await AuthStore.clear();
      AuthStore.onUnauthorized?.call();
    }
    return response;
  }
}
