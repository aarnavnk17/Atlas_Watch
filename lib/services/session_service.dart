import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_store.dart';
import 'backend_service.dart';

/// Owns registration, sign-in, and the current user's profile.
class SessionService {
  static const _profileCompleteKey = 'profile_complete';

  // ================================
  // REGISTER / LOGIN
  // ================================

  /// Returns null on success, or a message describing why registration failed.
  Future<String?> register({required String email, required String password}) async {
    try {
      final response = await BackendService.post(
        '/register',
        body: json.encode({'email': email, 'password': password}),
      );
      final data = json.decode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200 && data['token'] != null) {
        await AuthStore.save(token: data['token'], email: data['email'] ?? email);
        return null;
      }
      return data['error'] ?? data['message'] ?? 'Registration failed';
    } catch (e) {
      debugPrint('Registration failed: $e');
      return 'Could not reach the AtlasWatch server. Check your connection.';
    }
  }

  Future<bool> login(String identifier, String password) async {
    try {
      final response = await BackendService.post(
        '/login',
        body: json.encode({'email': identifier, 'password': password}),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final token = data['token'];
        final email = data['email'];
        if (token != null && email != null) {
          await AuthStore.save(token: token, email: email);
          return true;
        }
      }
    } catch (e) {
      debugPrint('Login failed: $e');
    }
    return false;
  }

  Future<String?> getEmail() => AuthStore.email();

  Future<bool> isLoggedIn() => AuthStore.hasSession();

  Future<void> logout() => AuthStore.clear();

  // ================================
  // PROFILE
  // ================================

  Future<bool> isProfileComplete() async {
    if (!await AuthStore.hasSession()) return false;
    try {
      final response = await BackendService.get('/profile');
      if (response.statusCode != 200) return false;
      final data = json.decode(response.body);
      return data['profile'] != null;
    } catch (e) {
      debugPrint('isProfileComplete check failed: $e');
      return false;
    }
  }

  Future<Map<String, dynamic>?> loadProfile() async {
    if (!await AuthStore.hasSession()) return null;
    try {
      final response = await BackendService.get('/profile');
      if (response.statusCode != 200) return null;
      final data = json.decode(response.body);
      return data['profile'] as Map<String, dynamic>?;
    } catch (e) {
      debugPrint('loadProfile failed: $e');
      return null;
    }
  }

  Future<bool> saveProfile({
    String? fullName,
    String? phoneNumber,
    String? passport,
    String? documentType,
    String? nationality,
    String? bloodGroup,
    String? medicalConditions,
    String? allergies,
    bool? isStudent,
    String? universityName,
    bool? isWorking,
    String? organizationName,
  }) async {
    if (!await AuthStore.hasSession()) return false;

    try {
      final response = await BackendService.post(
        '/profile',
        body: json.encode({
          'fullName': fullName,
          'phoneNumber': phoneNumber,
          'passport': passport,
          'documentType': documentType,
          'nationality': nationality,
          'bloodGroup': bloodGroup,
          'medicalConditions': medicalConditions,
          'allergies': allergies,
          'isStudent': isStudent,
          'universityName': universityName,
          'isWorking': isWorking,
          'organizationName': organizationName,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('saveProfile failed: $e');
      return false;
    }
  }

  Future<void> setProfileComplete(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_profileCompleteKey, value);
  }
}
