import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:latlong2/latlong.dart';

/// One city row from the shared crime dataset.
class CityCrimeEntry {
  final String city;
  final String state;
  final String risk;
  final int score;
  final Map<String, int> areas;
  final LatLng? coordinates;

  const CityCrimeEntry({
    required this.city,
    required this.state,
    required this.risk,
    required this.score,
    required this.areas,
    this.coordinates,
  });
}

/// Loads `backend/data/crime_data.json` — the same file the backend rule engine
/// reads and seeds into MongoDB.
///
/// This used to be three hand-maintained copies (a table in the Dart client, a
/// table in the Node engine, and the JSON itself), which is how the app and the
/// server ended up disagreeing about how dangerous a city was.
class CrimeDataset {
  static const String assetPath = 'backend/data/crime_data.json';

  /// Alternate and historical city names.
  static const Map<String, String> _aliases = {
    'bangalore': 'bengaluru',
    'bombay': 'mumbai',
    'madras': 'chennai',
    'calcutta': 'kolkata',
    'delhi': 'new delhi',
    'cochin': 'kochi',
    'trivandrum': 'thiruvananthapuram',
    'calicut': 'kozhikode',
    'mysore': 'mysuru',
    'hubli': 'hubballi',
    'mangalore': 'mangaluru',
    'belgaum': 'belagavi',
    'gurgaon': 'gurugram',
    'trichy': 'tiruchirappalli',
    'kovai': 'coimbatore',
    'vizag': 'visakhapatnam',
    'pondicherry': 'puducherry',
  };

  static final Map<String, CityCrimeEntry> _byKey = {};
  static List<String> _keysLongestFirst = const [];
  static int _maxRawScore = 1;
  static Future<void>? _loading;

  static bool get isLoaded => _byKey.isNotEmpty;
  static int get maxRawScore => _maxRawScore;

  /// Loads the dataset once; concurrent callers share the same future.
  static Future<void> ensureLoaded() {
    if (isLoaded) return Future.value();
    return _loading ??= _load();
  }

  static Future<void> _load() async {
    try {
      final rawJson = await rootBundle.loadString(assetPath);
      final decoded = json.decode(rawJson) as Map<String, dynamic>;

      for (final stateEntry in decoded.entries) {
        final cities = stateEntry.value as Map<String, dynamic>;
        for (final cityEntry in cities.entries) {
          final stats = cityEntry.value as Map<String, dynamic>;
          final key = cityEntry.key.trim().toLowerCase();
          if (_byKey.containsKey(key)) continue; // ambiguous names stay deterministic

          final lat = stats['lat'];
          final lng = stats['lng'];
          _byKey[key] = CityCrimeEntry(
            city: cityEntry.key,
            state: stateEntry.key,
            risk: stats['risk']?.toString() ?? 'Unknown',
            score: (stats['score'] as num?)?.toInt() ?? 0,
            areas: <String, int>{
              for (final area in (stats['areas'] as Map<String, dynamic>? ?? {}).entries)
                area.key: (area.value as num).toInt(),
            },
            coordinates: (lat is num && lng is num) ? LatLng(lat.toDouble(), lng.toDouble()) : null,
          );
        }
      }

      _aliases.forEach((alias, canonical) {
        final entry = _byKey[canonical];
        if (entry != null) _byKey.putIfAbsent(alias, () => entry);
      });

      _keysLongestFirst = _byKey.keys.toList()..sort((a, b) => b.length.compareTo(a.length));
      _maxRawScore = _byKey.values.fold<int>(1, (max, e) => e.score > max ? e.score : max);
    } catch (e) {
      debugPrint('CrimeDataset: failed to load $assetPath — $e');
    }
    return;
  }

  /// Resolves free text ("Chennai Central, Tamil Nadu, India") to a city row.
  static CityCrimeEntry? lookup(String location) {
    if (!isLoaded) return null;
    final loc = location.toLowerCase().trim();
    final tokens = loc.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

    for (final key in _keysLongestFirst) {
      if (tokens.contains(key)) return _byKey[key];
    }
    for (final key in _keysLongestFirst) {
      for (final token in tokens) {
        if (token.contains(key)) return _byKey[key];
      }
    }
    for (final key in _keysLongestFirst) {
      if (loc.contains(key)) return _byKey[key];
    }
    return null;
  }

  /// Coordinates for a city name, used to centre the journey map.
  static LatLng? coordinatesFor(String location) => lookup(location)?.coordinates;

  /// Nearest dataset city to a position, within [maxDegrees] (~200 km by default).
  static CityCrimeEntry? nearest(double lat, double lng, {double maxDegrees = 1.8}) {
    if (!isLoaded) return null;

    CityCrimeEntry? closest;
    double best = double.infinity;
    for (final entry in _byKey.values) {
      final coords = entry.coordinates;
      if (coords == null) continue;
      final dLat = coords.latitude - lat;
      final dLng = coords.longitude - lng;
      final distanceSquared = dLat * dLat + dLng * dLng;
      if (distanceSquared < best) {
        best = distanceSquared;
        closest = entry;
      }
    }
    if (closest == null || best > maxDegrees * maxDegrees) return null;
    return closest;
  }
}
