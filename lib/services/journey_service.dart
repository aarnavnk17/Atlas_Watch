import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'auth_store.dart';
import 'backend_service.dart';

class JourneyService {
  Future<bool> startJourney({
    required String startLocation,
    required String endLocation,
    required String mode,
    required String reference,
    required String riskLevel,
  }) async {
    if (!await AuthStore.hasSession()) return false;

    try {
      final response = await BackendService.post(
        '/journey',
        body: jsonEncode({
          'startLocation': startLocation,
          'endLocation': endLocation,
          'mode': mode,
          'reference': reference,
          'riskLevel': riskLevel,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Failed to start journey: $e');
      return false;
    }
  }

  Future<bool> endJourney() async {
    if (!await AuthStore.hasSession()) return false;

    try {
      final response = await BackendService.delete('/journey');

      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Failed to end journey: $e');
      return false;
    }
  }
}
