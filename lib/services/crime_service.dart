import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'backend_service.dart';

/// Recorded crime statistics for an area.
///
/// A score of 0 with [found] false means "no data for this place" — the backend
/// no longer invents a number from a hash of the search string.
class CrimeStats {
  final bool found;
  final String? city;
  final String? risk;
  final int score;

  const CrimeStats({required this.found, this.city, this.risk, this.score = 0});

  static const CrimeStats unknown = CrimeStats(found: false);
}

class CrimeService {
  Future<CrimeStats> fetchStats(String area) async {
    if (area.trim().isEmpty) return CrimeStats.unknown;

    try {
      final response = await BackendService.get('/crime-stats?area=${Uri.encodeComponent(area)}');
      if (response.statusCode != 200) return CrimeStats.unknown;

      final data = json.decode(response.body) as Map<String, dynamic>;
      if (data['found'] != true) return CrimeStats.unknown;

      return CrimeStats(
        found: true,
        city: data['city'] as String?,
        risk: data['risk'] as String?,
        score: (data['score'] as num? ?? 0).toInt(),
      );
    } catch (e) {
      debugPrint('CrimeService: lookup failed — $e');
      return CrimeStats.unknown;
    }
  }

  /// Raw recorded-incident count for an area, or 0 when unknown.
  Future<int> fetchCrimeScore(String area) async => (await fetchStats(area)).score;

  /// Nearest city with crime data to a coordinate.
  Future<CrimeStats> fetchStatsByLocation(double lat, double lng, {int distanceMeters = 20000}) async {
    try {
      final response = await BackendService.get(
        '/crime-stats/proximity?lat=$lat&lng=$lng&distance=$distanceMeters',
      );
      if (response.statusCode != 200) return CrimeStats.unknown;

      final data = json.decode(response.body) as Map<String, dynamic>;
      final results = (data['data'] as List?) ?? const [];
      if (results.isEmpty) return CrimeStats.unknown;

      final closest = results.first as Map<String, dynamic>;
      return CrimeStats(
        found: true,
        city: closest['city'] as String?,
        risk: closest['risk'] as String?,
        score: (closest['score'] as num? ?? 0).toInt(),
      );
    } catch (e) {
      debugPrint('CrimeService: proximity lookup failed — $e');
      return CrimeStats.unknown;
    }
  }
}
