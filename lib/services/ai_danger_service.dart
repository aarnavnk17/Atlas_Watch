import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../data/crime_dataset.dart';
import 'backend_service.dart';
import 'geofence_service.dart';

class SubScore {
  final String label;
  final String icon;
  final int score;
  final String detail;
  const SubScore({required this.label, required this.icon, required this.score, required this.detail});
}

class DangerAssessment {
  final int score;
  final String severity;
  final String reasoning;
  final bool shouldTriggerSos;
  final List<String> riskFactors;
  final Map<String, dynamic>? breakdown;
  final String? aiSource;
  final String? geofenceZoneName;
  final String? geofenceZoneType;

  const DangerAssessment({
    required this.score, required this.severity, required this.reasoning,
    required this.shouldTriggerSos, required this.riskFactors,
    this.breakdown, this.aiSource, this.geofenceZoneName, this.geofenceZoneType,
  });

  factory DangerAssessment.fromJson(Map<String, dynamic> json) {
    return DangerAssessment(
      score           : (json['score'] as num? ?? 0).toInt().clamp(0, 100),
      severity        : json['severity'] ?? 'safe',
      reasoning       : json['reasoning'] ?? 'Assessment complete.',
      shouldTriggerSos: json['shouldTriggerSos'] ?? false,
      riskFactors     : List<String>.from(json['riskFactors'] ?? []),
      breakdown       : json['breakdown'] as Map<String, dynamic>?,
      aiSource        : json['aiSource'] as String?,
      geofenceZoneName: json['geofenceZoneName'] as String?,
      geofenceZoneType: json['geofenceZoneType'] as String?,
    );
  }

  factory DangerAssessment.fallback() => const DangerAssessment(
    score: 0, severity: 'safe',
    reasoning: 'Risk assessment temporarily unavailable.',
    shouldTriggerSos: false, riskFactors: [], aiSource: 'offline',
  );

  String get aiSourceLabel {
    if (aiSource == null || aiSource == 'rule_engine') return 'Built-in AI';
    if (aiSource == 'offline') return 'Offline';
    return aiSource![0].toUpperCase() + aiSource!.substring(1);
  }

  List<SubScore> get subScores {
    final bd = breakdown;
    if (bd == null) return [];

    final recentReports = (bd['recentReports'] as num? ?? bd['reportVelocity'] as num? ?? 0).toInt();
    final locProfile    = (bd['locationProfile'] as num? ?? 0).toInt();

    return [
      SubScore(label: 'Crime History', icon: '🗂️',
          score: (bd['crimeBase'] as num? ?? 0).toInt().clamp(0, 100),
          detail: 'Historical crime rate for this area'),
      SubScore(label: 'Area Profile', icon: '📍',
          score: math.max(locProfile, recentReports).clamp(0, 100),
          detail: 'Known risk level and recent incidents'),
      SubScore(label: 'Time of Day', icon: '🕐',
          score: (bd['temporalRisk'] as num? ?? 0).toInt().clamp(0, 100),
          detail: 'Risk based on current hour & day'),
      SubScore(label: 'Transport Risk', icon: '🚗',
          score: (bd['transportRisk'] as num? ?? 0).toInt().clamp(0, 100),
          detail: 'Vulnerability based on travel mode'),
      SubScore(label: 'Geofence', icon: '🔺',
          score: (bd['behavioural'] as num? ?? 0).toInt().clamp(0, 100),
          detail: geofenceZoneName != null
              ? 'Zone: $geofenceZoneName ($geofenceZoneType)'
              : 'Movement & zone behaviour'),
    ];
  }
}

class AiDangerService {
  static const int sosTriggerThreshold = 75;

  bool prolongedInactivity = false;
  bool geofenceBreach      = false;

  void setFlag({bool? inactivity, bool? geofence}) {
    if (inactivity != null) prolongedInactivity = inactivity;
    if (geofence   != null) geofenceBreach      = geofence;
  }

  Future<DangerAssessment> assess({
    required String location,
    String? destination,
    double? lat,
    double? lng,
    String? transportMode,               // 'Car', 'Bike', 'Bus', 'Walk', etc.
    List<Map<String, double>>? routeWaypoints,
  }) async {
    await CrimeDataset.ensureLoaded();

    // 1. Geofence check
    String? geofenceZoneName;
    String? geofenceZoneType;

    if (lat != null && lng != null) {
      try {
        final zones = await GeofenceService().fetchZones();
        for (final zone in zones) {
          final dist = _haversineMeters(lat, lng, zone.centerLat, zone.centerLng);
          if (dist <= zone.radiusMeters) {
            geofenceZoneName = zone.name;
            geofenceZoneType = zone.type;
            if (zone.type == 'restricted' || zone.type == 'high-risk') {
              setFlag(geofence: true);
            } else if (zone.type == 'safe') {
              setFlag(geofence: false);
            }
            break;
          }
        }
      } catch (e) {
        debugPrint('[AI] Geofence check error: $e');
      }
    }

    // 2. Backend call
    try {
      final now = DateTime.now();
      final params = <String, String>{
        'location': location,
        if (destination != null && destination.isNotEmpty) 'destination': destination,
        if (lat != null) 'lat': lat.toStringAsFixed(5),
        if (lng != null) 'lng': lng.toStringAsFixed(5),
        'mode': ?transportMode,
        if (prolongedInactivity) 'prolongedInactivity': 'true',
        if (geofenceBreach) 'geofenceBreach': 'true',
        'geofenceZoneType': ?geofenceZoneType,
        'geofenceZoneName': ?geofenceZoneName,
        // Time-of-day risk is about the user's local night. Without this the
        // server scored against its own clock, which is wrong the moment the
        // backend is hosted in another region — or the user travels.
        'localHour': now.hour.toString(),
        'tzOffsetMinutes': now.timeZoneOffset.inMinutes.toString(),
      };

      final qs = params.entries
          .map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
          .join('&');

      final response = await BackendService.get('/ai-danger-score?$qs');
      if (response.statusCode != 200) {
        return _localFallback(location: location,
            geofenceZoneName: geofenceZoneName, geofenceZoneType: geofenceZoneType,
            transportMode: transportMode, routeWaypoints: routeWaypoints);
      }

      final json = jsonDecode(response.body) as Map<String, dynamic>;
      if (json['success'] != true) {
        return _localFallback(location: location,
            geofenceZoneName: geofenceZoneName, geofenceZoneType: geofenceZoneType,
            transportMode: transportMode, routeWaypoints: routeWaypoints);
      }

      final base = DangerAssessment.fromJson(json);
      return DangerAssessment(
        score: base.score, severity: base.severity, reasoning: base.reasoning,
        shouldTriggerSos: base.shouldTriggerSos,
        riskFactors: [
          ...base.riskFactors,
          if (geofenceZoneName != null) 'Geofence: $geofenceZoneName ($geofenceZoneType)',
        ],
        breakdown: base.breakdown, aiSource: base.aiSource,
        geofenceZoneName: geofenceZoneName, geofenceZoneType: geofenceZoneType,
      );
    } catch (e) {
      debugPrint('[AI] Backend error: $e');
      return _localFallback(location: location,
          geofenceZoneName: geofenceZoneName, geofenceZoneType: geofenceZoneType,
          transportMode: transportMode, routeWaypoints: routeWaypoints);
    }
  }

  double _haversineMeters(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371000.0;
    final dLat = _rad(lat2 - lat1);
    final dLng = _rad(lng2 - lng1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_rad(lat1)) * math.cos(_rad(lat2)) * math.sin(dLng / 2) * math.sin(dLng / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  double _rad(double deg) => deg * math.pi / 180;

  /// Normalises a raw incident count to 0–65, matching the backend engine.
  int _normalizeCrimeScore(int rawScore) {
    if (rawScore <= 0) return 0;
    final ratio = rawScore / CrimeDataset.maxRawScore;
    return (math.sqrt(ratio) * 65).round().clamp(0, 65);
  }

  /// Offline scoring, used when the backend is unreachable. Reads the same
  /// bundled dataset the server uses, so the two stay consistent.
  DangerAssessment _localFallback({
    required String location,
    String? geofenceZoneName,
    String? geofenceZoneType,
    String? transportMode,
    List<Map<String, double>>? routeWaypoints,
  }) {
    final hour = DateTime.now().hour;
    final loc  = location.toLowerCase().trim();

    final entry      = CrimeDataset.lookup(loc);
    final cityName   = entry?.city ?? location.split(',').first.trim();
    final rawEntry   = entry?.score;
    final riskLabel  = entry?.risk ?? 'Unknown';
    final crimeScore = rawEntry != null ? _normalizeCrimeScore(rawEntry) : 35;

    // ── Time-of-day risk ───────────────────────────────────────
    final int timeRisk;
    if (hour >= 23 || hour < 3) {
      timeRisk = 65;
    } else if (hour >= 3 && hour < 6) {
      timeRisk = 45;
    } else if (hour >= 6 && hour < 9) {
      timeRisk = 20;
    } else if (hour >= 9 && hour < 17) {
      timeRisk = 10;
    } else if (hour >= 17 && hour < 20) {
      timeRisk = 18;
    } else {
      timeRisk = 30;
    }

    // ── Location type modifier ─────────────────────────────────
    int locModifier = 0;
    String? locType;
    for (final h in ['station', 'junction', 'bazaar', 'market', 'bus stand', 'naka', 'bus stop']) {
      if (loc.contains(h)) { locModifier = 15; locType = h; break; }
    }
    if (locModifier == 0) {
      for (final l in ['mall', 'hotel', 'resort', 'hospital', 'tech park', 'it park', 'airport']) {
        if (loc.contains(l)) { locModifier = -12; locType = l; break; }
      }
    }
    final locationProfile = (crimeScore + locModifier).clamp(0, 100);

    // ── Transport mode risk ────────────────────────────────────
    int transportRisk = 0;
    String? modeLabel;
    if (transportMode != null) {
      final m = transportMode.toLowerCase();
      if (m.contains('walk') || m.contains('foot')) {
        transportRisk = 30; modeLabel = 'Walking (highest vulnerability)';
      } else if (m.contains('bike') || m.contains('cycle') || m.contains('bicycle')) {
        transportRisk = 25; modeLabel = 'Cycling (high vulnerability)';
      } else if (m.contains('auto') || m.contains('rickshaw') || m.contains('tuk')) {
        transportRisk = 18; modeLabel = 'Auto/Rickshaw (moderate vulnerability)';
      } else if (m.contains('bus') || m.contains('public')) {
        transportRisk = 15; modeLabel = 'Bus/Public transport (moderate)';
      } else if (m.contains('car') || m.contains('taxi') || m.contains('cab') || m.contains('uber') || m.contains('ola')) {
        transportRisk = 8;  modeLabel = 'Car/Taxi (lower vulnerability)';
      } else if (m.contains('metro') || m.contains('train') || m.contains('rail')) {
        transportRisk = 5;  modeLabel = 'Metro/Train (lowest vulnerability)';
      } else {
        transportRisk = 10; modeLabel = transportMode;
      }
    }

    // ── Route corridor scoring ─────────────────────────────────
    // A journey is only as safe as its most dangerous stretch.
    int routeScore = crimeScore;
    final routeCitiesHit = <String>[];

    if (routeWaypoints != null && routeWaypoints.length >= 2) {
      final step = math.max(1, routeWaypoints.length ~/ 5);
      final samples = <int>[];
      for (int i = step; i < routeWaypoints.length; i += step) {
        final waypoint = routeWaypoints[i];
        final nearby = CrimeDataset.nearest(waypoint['lat']!, waypoint['lng']!);
        if (nearby != null) {
          samples.add(_normalizeCrimeScore(nearby.score));
          routeCitiesHit.add(nearby.city);
        }
      }
      if (samples.isNotEmpty) {
        routeScore = ((crimeScore + samples.reduce(math.max)) / 2).round();
      }
    }

    // ── Geofence ───────────────────────────────────────────────
    int geofenceRisk = 0;
    if (geofenceZoneType == 'high-risk')  geofenceRisk = 80;
    if (geofenceZoneType == 'restricted') geofenceRisk = 60;

    // ── Final score ────────────────────────────────────────────
    final timeMod      = ((timeRisk - 15) * 0.25).round();
    final transportMod = ((transportRisk - 8) * 0.20).round();
    final locMod       = ((locationProfile - routeScore) * 0.30).round();
    final geoMod       = (geofenceRisk * 0.08).round();
    final score = (routeScore + timeMod + transportMod + locMod + geoMod).clamp(5, 100);

    final timeDesc = timeRisk <= 10 ? 'daytime hours'
        : timeRisk <= 20 ? 'morning hours'
        : timeRisk <= 30 ? 'evening hours'
        : 'late-night hours';

    // An automatic SOS needs an actual event, not just a risky place at a risky
    // hour — the same rule the backend engine applies.
    final situationalSignal = prolongedInactivity || geofenceRisk > 0;

    String severity;
    String reasoning;
    if (score < 40) {
      severity  = 'safe';
      reasoning = '$cityName is a $riskLabel-crime city. No significant risk detected during $timeDesc.';
    } else if (score < 60) {
      severity  = 'caution';
      reasoning = '$cityName has a $riskLabel crime profile. Stay alert, especially during $timeDesc.';
    } else if (score < sosTriggerThreshold) {
      severity  = 'danger';
      reasoning = '$cityName has a $riskLabel crime rate. Avoid isolated areas and stay in well-lit zones.';
    } else {
      severity  = 'critical';
      reasoning = situationalSignal
          ? 'Critical danger level in $cityName. Emergency contacts will be alerted.'
          : 'Critical risk level in $cityName during $timeDesc. Stay alert and share your journey.';
    }

    return DangerAssessment(
      score: score,
      severity: severity,
      reasoning: reasoning,
      shouldTriggerSos: score >= sosTriggerThreshold && situationalSignal,
      riskFactors: [
        if (rawEntry != null) 'Crime data: $rawEntry recorded incidents ($riskLabel risk city)',
        if (modeLabel != null) 'Transport: $modeLabel',
        if (routeCitiesHit.isNotEmpty) 'Route passes through: ${routeCitiesHit.toSet().join(', ')}',
        if (timeRisk >= 45) 'Late-night hours significantly increase risk',
        if (timeRisk >= 30 && timeRisk < 45) 'Evening hours add moderate risk',
        if (locModifier > 0) 'High-footfall area type ($locType) increases risk',
        if (locModifier < 0) 'Low-risk venue type ($locType) reduces risk',
        if (geofenceRisk >= 60) 'Geofence alert: $geofenceZoneName ($geofenceZoneType)',
        if (rawEntry == null) 'City not in crime database — using default baseline',
      ],
      breakdown: {
        'crimeBase'      : routeScore,
        'locationProfile': locationProfile,
        'temporalRisk'   : timeRisk,
        'transportRisk'  : transportRisk,
        'recentReports'  : 0,
        'behavioural'    : geofenceRisk,
      },
      aiSource: 'offline',
      geofenceZoneName: geofenceZoneName,
      geofenceZoneType: geofenceZoneType,
    );
  }

  static String severityFromScore(int score) {
    if (score >= sosTriggerThreshold) return 'critical';
    if (score >= 60) return 'danger';
    if (score >= 40) return 'caution';
    return 'safe';
  }
}
