import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/risk_level.dart';
import 'auth_store.dart';
import 'backend_service.dart';
import 'crime_service.dart';
import 'location_service.dart';
import 'risk_service.dart';

typedef RiskUpdateCallback = void Function(RiskAnalysisResult result);

/// Records the user's position at intervals and runs anomaly analysis on it.
///
/// FR-3.2.6: record location coordinates at predefined intervals
/// FR-3.2.7: store location updates along with timestamps
/// FR-3.2.8: compute and display a safety status
/// FR-3.2.13–15: run anomaly detection on each update
///
/// A single shared timer serves every subscriber. Previously two independent
/// services each ran their own timer at different intervals with different risk
/// logic, and the journey screen's timer was never cancelled — so every journey
/// left another GPS poll running for the life of the process.
class TrackingService {
  TrackingService._();
  static final TrackingService instance = TrackingService._();

  /// Background cadence while the app is simply open and signed in.
  static const Duration ambientInterval = Duration(minutes: 5);

  /// Faster cadence while a journey is being tracked.
  static const Duration journeyInterval = Duration(minutes: 2);

  static const Object ambientKey = #ambient;

  final Map<Object, _Subscription> _subscriptions = {};
  final LocationService _locationService = LocationService();
  final CrimeService _crimeService = CrimeService();
  final RiskService _riskService = RiskService();

  Timer? _timer;
  Duration? _currentInterval;

  bool get isTracking => _timer?.isActive ?? false;

  /// Registers interest in tracking. The fastest requested interval wins.
  /// Every caller must pair this with [unsubscribe].
  void subscribe(Object key, {Duration interval = ambientInterval, RiskUpdateCallback? onUpdate}) {
    _subscriptions[key] = _Subscription(interval, onUpdate);
    _syncTimer(runImmediately: true);
  }

  void unsubscribe(Object key) {
    _subscriptions.remove(key);
    _syncTimer();
  }

  /// Stops tracking entirely — used on sign-out.
  void stopAll() {
    _subscriptions.clear();
    _syncTimer();
  }

  void _syncTimer({bool runImmediately = false}) {
    if (_subscriptions.isEmpty) {
      _timer?.cancel();
      _timer = null;
      _currentInterval = null;
      debugPrint('📍 Tracking stopped (no subscribers)');
      return;
    }

    final fastest = _subscriptions.values
        .map((s) => s.interval)
        .reduce((a, b) => a < b ? a : b);

    if (_timer != null && _currentInterval == fastest) {
      if (runImmediately) unawaited(_tick());
      return;
    }

    _timer?.cancel();
    _currentInterval = fastest;
    _timer = Timer.periodic(fastest, (_) => _tick());
    debugPrint('📍 Tracking started (every ${fastest.inMinutes} min)');
    unawaited(_tick());
  }

  Future<void> _tick() async {
    if (!await AuthStore.hasSession()) return;

    try {
      final fix = await _locationService.fetchCurrentLocation();
      if (fix == null) return;

      final lat = fix.position.latitude;
      final lng = fix.position.longitude;

      // Area crime score, used only as a coarse label on the stored fix.
      final crimeScore = await _crimeService.fetchCrimeScore(fix.address ?? '');
      final riskLabel = crimeScore >= 8000
          ? 'high'
          : crimeScore >= 4000
              ? 'medium'
              : 'low';

      await BackendService.post(
        '/location',
        body: json.encode({
          'lat': lat,
          'lng': lng,
          'address': fix.address,
          'accuracy': fix.position.accuracy,
          'riskLevel': riskLabel,
          'timestamp': DateTime.now().toIso8601String(),
        }),
      );

      final analysis = await _riskService.analyzeLocation(lat: lat, lng: lng);

      debugPrint(
        '📍 [$lat, $lng] risk=${analysis.riskLevel.label} '
        'anomaly=${analysis.anomalyFlag} reason="${analysis.reason}"',
      );

      for (final subscription in _subscriptions.values.toList()) {
        subscription.onUpdate?.call(analysis);
      }
    } catch (e) {
      debugPrint('📍 Tracking tick error: $e');
    }
  }

  /// One-shot analysis, e.g. when the app resumes.
  Future<RiskAnalysisResult?> analyzeNow() async {
    if (!await AuthStore.hasSession()) return null;
    try {
      final fix = await _locationService.fetchCurrentLocation();
      if (fix == null) return null;
      return await _riskService.analyzeLocation(
        lat: fix.position.latitude,
        lng: fix.position.longitude,
      );
    } catch (e) {
      debugPrint('📍 analyzeNow error: $e');
      return null;
    }
  }
}

class _Subscription {
  final Duration interval;
  final RiskUpdateCallback? onUpdate;
  const _Subscription(this.interval, this.onUpdate);
}
